import { maxHistoryPreviewItems } from "@shared/Configuration"
import { StringRequest } from "@shared/proto/cline/common"
import { GetTaskHistoryRequest } from "@shared/proto/cline/task"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { memo, useCallback, useEffect, useState } from "react"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { TaskServiceClient } from "@/services/grpc-client"
import { formatLargeNumber } from "@/utils/format"
import HeroTooltip from "../common/HeroTooltip"
import { primaryFontSize } from "../config"

type HistoryPreviewProps = {
	showHistoryView: () => void
}

// Tailwind-styled radio with custom icon support
interface CustomFilterRadioProps {
	checked: boolean
	onChange: () => void
	icon?: string
	label: string
}

const CustomFilterRadio = ({ checked, onChange, icon, label }: CustomFilterRadioProps) => {
	return (
		<div className="flex items-center cursor-pointer select-none text-xs" onClick={onChange}>
			<div className="scale-90 w-[14px] h-[14px] border border-(--vscode-checkbox-border) bg-(--vscode-checkbox-background) relative flex justify-center items-center mr-[6px]">
				{checked && <div className="w-[6px] h-[6px] bg-(--vscode-checkbox-foreground)" />}
			</div>
			<div className={`codicon codicon-${icon}`} />
			{label}
		</div>
	)
}

const HistoryPreview = ({ showHistoryView }: HistoryPreviewProps) => {
	const { taskHistory } = useExtensionState()
	const [isExpanded, setIsExpanded] = useState(() => {
		try {
			const saved = localStorage.getItem("historyPreview-isExpanded")
			return saved ? JSON.parse(saved) : false
		} catch (error) {
			console.warn("Failed to load expansion state from localStorage:", error)
			return false
		}
	})
	const [showCurrentWorkspaceOnly, setShowCurrentWorkspaceOnly] = useState(() => {
		try {
			const saved = localStorage.getItem("historyPreview-showCurrentWorkspaceOnly")
			return saved ? JSON.parse(saved) : true
		} catch (error) {
			console.warn("Failed to load workspace filter state from localStorage:", error)
			return true
		}
	})
	const [filteredTasks, setFilteredTasks] = useState<any[]>([])

	// Save to localStorage whenever isExpanded changes
	useEffect(() => {
		localStorage.setItem("historyPreview-isExpanded", JSON.stringify(isExpanded))
	}, [isExpanded])

	// Save to localStorage whenever showCurrentWorkspaceOnly changes
	useEffect(() => {
		localStorage.setItem("historyPreview-showCurrentWorkspaceOnly", JSON.stringify(showCurrentWorkspaceOnly))
	}, [showCurrentWorkspaceOnly])

	// Load filtered task history with gRPC
	const loadTaskHistory = useCallback(async () => {
		try {
			const response = await TaskServiceClient.getTaskHistory(
				GetTaskHistoryRequest.create({
					currentWorkspaceOnly: showCurrentWorkspaceOnly,
				}),
			)
			setFilteredTasks(response.tasks || [])
		} catch (error) {
			console.error("Error loading task history:", error)
			// Fallback to local taskHistory if API fails
			setFilteredTasks(taskHistory || [])
		}
	}, [showCurrentWorkspaceOnly, taskHistory])

	// Load when filter changes or taskHistory updates
	useEffect(() => {
		if (showCurrentWorkspaceOnly) {
			loadTaskHistory()
		} else {
			// Use local taskHistory when workspace filter is off
			setFilteredTasks(taskHistory || [])
		}
	}, [loadTaskHistory, showCurrentWorkspaceOnly, taskHistory])

	// Get tasks to display
	const tasksToDisplay = filteredTasks.filter((item) => item.ts && item.task).slice(0, maxHistoryPreviewItems)

	const handleHistorySelect = (id: string) => {
		TaskServiceClient.showTaskWithId(StringRequest.create({ value: id })).catch((error) =>
			console.error("Error showing task:", error),
		)
	}

	const toggleExpanded = () => {
		setIsExpanded(!isExpanded)
	}

	const formatTime = (timestamp: number) => {
		const now = Date.now()
		const diffMs = Math.max(now - timestamp, 0)
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
		if (diffDays >= 1) {
			return `${diffDays}d`
		}
		const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
		if (diffHours >= 1) {
			return `${diffHours}h`
		}
		const diffMinutes = Math.floor(diffMs / (1000 * 60))
		return `${diffMinutes}m`
	}

	return (
		<div style={{ flexShrink: 0 }}>
			<style>
				{`
					.history-preview-item {
						background-color: color-mix(in srgb, var(--vscode-toolbar-hoverBackground) 65%, transparent);
						border-radius: 8px;
						position: relative;
						overflow: hidden;
						opacity: 1;
						cursor: pointer;
						margin-bottom: 5px;
					}
					.history-preview-item:hover {
						background-color: color-mix(in srgb, var(--vscode-toolbar-hoverBackground) 100%, transparent);
						pointer-events: auto;
					}
					.history-task-content {
						flex: 1;
						display: flex;
						align-items: flex-start;
						gap: 8px;
						min-width: 0;
					}
					.history-task-description {
						flex: 1;
						overflow: hidden;
						display: -webkit-box;
						-webkit-line-clamp: 2;
						-webkit-box-orient: vertical;
						color: var(--vscode-foreground);
						font-size: var(--vscode-font-size);
						line-height: 1.4;
					}
					.history-meta-stack {
						display: flex;
						flex-direction: column;
						align-items: center;
						gap: 4px;
						flex-shrink: 0;
					}
					.history-header:hover {
						opacity: 0.8;
					}
					.history-date {
						color: var(--vscode-descriptionForeground);
						font-size: 0.85em;
						white-space: nowrap;
					}
					.history-cost-chip {
						background-color: var(--vscode-badge-background);
						color: var(--vscode-badge-foreground);
						padding: 2px 8px;
						border-radius: 12px;
						font-size: 0.85em;
						font-weight: 500;
						white-space: nowrap;
					}
				`}
			</style>

			<div
				className="history-header"
				onClick={toggleExpanded}
				style={{
					// color: "var(--vscode-descriptionForeground)",
					margin: "10px 20px 15px 20px",
					display: "flex",
					alignItems: "center",
					cursor: "pointer",
				}}>
				<span
					className={`codicon codicon-chevron-${isExpanded ? "down" : "right"}`}
					style={
						{
							// marginRight: "6px",
							// transform: "scale(0.9)",
						}
					}></span>
				<span
					className="codicon codicon-tasklist"
					style={{
						marginRight: "6px",
						//transform: "scale(0.9)",
					}}></span>
				<span
					style={{
						fontWeight: 600,
						textTransform: "uppercase",
						fontSize: "12px",
					}}>
					Recent Tasks
				</span>
			</div>

			{isExpanded && (
				<div className="flex mb-2 ml-7 text-(--vscode-descriptionForeground)">
					<CustomFilterRadio
						checked={showCurrentWorkspaceOnly}
						label="Current workspace"
						onChange={() => setShowCurrentWorkspaceOnly(!showCurrentWorkspaceOnly)}
					/>
					<HeroTooltip content="Show only tasks from the current workspace">
						<span className="codicon codicon-info ml-1 opacity-70 cursor-pointer" style={{ fontSize: "12px" }} />
					</HeroTooltip>
				</div>
			)}

			{isExpanded && (
				<div style={{ padding: "5px 8px 0 20px" }}>
					{tasksToDisplay.length > 0 ? (
						<>
							{tasksToDisplay.map((item) => (
								<div className="history-preview-item" key={item.id} onClick={() => handleHistorySelect(item.id)}>
									<div style={{ padding: "3px 8px" }}>
										<div
											className="history-preview-task"
											id={`history-preview-task-${item.id}`}
											style={{
												fontSize: primaryFontSize,
												opacity: 0.9,
												marginBottom: "2px",
												// marginTop: "1px",
												// marginLeft: "0px",
												marginRight: "15px",
												display: "-webkit-box",
												WebkitLineClamp: 1,
												WebkitBoxOrient: "vertical",
												overflow: "hidden",
												whiteSpace: "pre-wrap",
												wordBreak: "break-word",
												overflowWrap: "anywhere",
											}}>
											<span className="ph-no-capture">{item.task}</span>
										</div>
										{item.isFavorited && (
											<div
												style={{
													position: "absolute",
													top: "4px",
													right: "6px",
													color: "var(--vscode-button-background)",
												}}>
												<span
													aria-label="Favorited"
													className="codicon codicon-star-full"
													style={{ fontSize: "12px" }}
												/>
											</div>
										)}
										<div style={{ padding: "0px 0px 0px 0px" }}>
											<span style={{ marginBottom: "0px" }}>
												<span
													style={{
														color: "var(--vscode-descriptionForeground)",
														//fontWeight: "bold",
														fontSize: "0.90em",
														// opacity: 0.7,
														//textTransform: "uppercase",
													}}>
													{formatTime(item.ts)}
												</span>
											</span>
											<span
												style={{
													marginLeft: "0px",
													fontSize: "0.85em",
													//fontWeight: "bold",
													opacity: 0.8,
													color: "var(--vscode-descriptionForeground)",
												}}>
												<span>
													{" • "}Tokens: ↑{formatLargeNumber(item.tokensIn || 0)} ↓
													{formatLargeNumber(item.tokensOut || 0)}
												</span>
												{/* {!!item.cacheWrites && (
													<>
														{" • "}
														<span>
															Cache: +{formatLargeNumber(item.cacheWrites || 0)} →{" "}
															{formatLargeNumber(item.cacheReads || 0)}
														</span>
													</>
												)}
												{!!item.totalCost && (
													<>
														{" • "}
														<span>Cost: ${item.totalCost?.toFixed(4)}</span>
													</>
												)} */}
											</span>
										</div>
									</div>
								</div>
							))}
							<div
								style={{
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
								}}>
								<VSCodeButton
									appearance="icon"
									aria-label="View all history"
									onClick={() => showHistoryView()}
									style={{
										opacity: 0.8,
									}}>
									<div
										style={{
											fontSize: "0.9em",
											//fontSize: "var(--vscode-font-size)",
											color: "var(--vscode-descriptionForeground)",
										}}>
										View All
									</div>
								</VSCodeButton>
							</div>
						</>
					) : (
						<div
							style={{
								textAlign: "left",
								color: "var(--vscode-descriptionForeground)",
								fontSize: "12px",
								padding: "5px 4px",
							}}>
							No task history available {showCurrentWorkspaceOnly ? "for the current workspace." : "."}
						</div>
					)}
				</div>
			)}
		</div>
	)
}

export default memo(HistoryPreview)
