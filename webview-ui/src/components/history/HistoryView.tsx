import { BooleanRequest, EmptyRequest, StringArrayRequest, StringRequest } from "@shared/proto/cline/common"
import { GetTaskHistoryRequest } from "@shared/proto/cline/task"
import { VSCodeButton, VSCodeCheckbox, VSCodeRadio, VSCodeRadioGroup, VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import Fuse, { FuseResult } from "fuse.js"
import { memo, useCallback, useEffect, useMemo, useState } from "react"
import { Virtuoso } from "react-virtuoso"
import DangerButton from "@/components/common/DangerButton"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { TaskServiceClient } from "@/services/grpc-client"
import { getEnvironmentColor } from "@/utils/environmentColors"
import { formatLargeNumber, formatSize } from "@/utils/format"

type HistoryViewProps = {
	onDone: () => void
}

type SortOption = "newest" | "oldest" | "mostExpensive" | "mostTokens" | "mostRelevant"

// Tailwind-styled radio with custom icon support - works independently of VSCodeRadioGroup but looks the same
// Used for workspace and favorites filters

interface CustomFilterRadioProps {
	checked: boolean
	onChange: () => void
	icon: string
	label: string
}

const CustomFilterRadio = ({ checked, onChange, icon, label }: CustomFilterRadioProps) => {
	return (
		<div
			className="scale-90 flex items-center cursor-pointer py-[0em] px-0 mr-[10px] text-[var(--vscode-font-size)] select-none"
			onClick={onChange}>
			<div
				className={`w-[14px] h-[14px] border border-[var(--vscode-checkbox-border)] relative flex justify-center items-center mr-[6px] ${
					checked ? "bg-[var(--vscode-checkbox-background)]" : "bg-transparent"
				}`}>
				{checked && <div className="w-[6px] h-[6px] bg-[var(--vscode-checkbox-foreground)]" />}
			</div>
			<span className="flex items-center gap-[3px]">
				<div className={`codicon codicon-${icon} text-(--vscode-button-background) text-base`} />
				{label}
			</span>
		</div>
	)
}

const HistoryView = ({ onDone }: HistoryViewProps) => {
	const extensionStateContext = useExtensionState()
	const { taskHistory, onRelinquishControl, environment } = extensionStateContext
	const [searchQuery, setSearchQuery] = useState("")
	const [sortOption, setSortOption] = useState<SortOption>("newest")
	const [lastNonRelevantSort, setLastNonRelevantSort] = useState<SortOption | null>("newest")
	const [deleteAllDisabled, setDeleteAllDisabled] = useState(false)
	const [selectedItems, setSelectedItems] = useState<string[]>([])
	const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
	const [showCurrentWorkspaceOnly, setShowCurrentWorkspaceOnly] = useState(false)

	// Keep track of pending favorite toggle operations
	const [pendingFavoriteToggles, setPendingFavoriteToggles] = useState<Record<string, boolean>>({})

	// Load filtered task history with gRPC
	const [tasks, setTasks] = useState<any[]>([])

	// Load and refresh task history
	const loadTaskHistory = useCallback(async () => {
		try {
			const response = await TaskServiceClient.getTaskHistory(
				GetTaskHistoryRequest.create({
					favoritesOnly: showFavoritesOnly,
					searchQuery: searchQuery || undefined,
					sortBy: sortOption,
					currentWorkspaceOnly: showCurrentWorkspaceOnly,
				}),
			)
			setTasks(response.tasks || [])
		} catch (error) {
			console.error("Error loading task history:", error)
		}
	}, [showFavoritesOnly, showCurrentWorkspaceOnly, searchQuery, sortOption, taskHistory])

	// Load when filters change
	useEffect(() => {
		// Force a complete refresh when both filters are active
		// to ensure proper combined filtering
		if (showFavoritesOnly && showCurrentWorkspaceOnly) {
			setTasks([])
		}
		loadTaskHistory()
	}, [loadTaskHistory, showFavoritesOnly, showCurrentWorkspaceOnly])

	// const toggleFavorite = useCallback(
	// 	async (taskId: string, currentValue: boolean) => {
	// 		// Optimistic UI update
	// 		setPendingFavoriteToggles((prev) => ({ ...prev, [taskId]: !currentValue }))

	// 		try {
	// 			await TaskServiceClient.toggleTaskFavorite(
	// 				TaskFavoriteRequest.create({
	// 					taskId,
	// 					isFavorited: !currentValue,
	// 				}),
	// 			)

	// 			// Refresh if either filter is active to ensure proper combined filtering
	// 			if (showFavoritesOnly || showCurrentWorkspaceOnly) {
	// 				loadTaskHistory()
	// 			}
	// 		} catch (err) {
	// 			console.error(`[FAVORITE_TOGGLE_UI] Error for task ${taskId}:`, err)
	// 			// Revert optimistic update
	// 			setPendingFavoriteToggles((prev) => {
	// 				const updated = { ...prev }
	// 				delete updated[taskId]
	// 				return updated
	// 			})
	// 		} finally {
	// 			// Clean up pending state after 1 second
	// 			setTimeout(() => {
	// 				setPendingFavoriteToggles((prev) => {
	// 					const updated = { ...prev }
	// 					delete updated[taskId]
	// 					return updated
	// 				})
	// 			}, 1000)
	// 		}
	// 	},
	// 	[showFavoritesOnly, loadTaskHistory],
	// )

	// Use the onRelinquishControl hook instead of message event
	useEffect(() => {
		return onRelinquishControl(() => {
			setDeleteAllDisabled(false)
		})
	}, [onRelinquishControl])

	const { totalTasksSize, setTotalTasksSize } = extensionStateContext

	const fetchTotalTasksSize = useCallback(async () => {
		try {
			const response = await TaskServiceClient.getTotalTasksSize(EmptyRequest.create({}))
			if (response && typeof response.value === "number") {
				setTotalTasksSize?.(response.value || 0)
			}
		} catch (error) {
			console.error("Error getting total tasks size:", error)
		}
	}, [setTotalTasksSize])

	// Request total tasks size when component mounts
	useEffect(() => {
		fetchTotalTasksSize()
	}, [fetchTotalTasksSize])

	useEffect(() => {
		if (searchQuery && sortOption !== "mostRelevant" && !lastNonRelevantSort) {
			setLastNonRelevantSort(sortOption)
			setSortOption("mostRelevant")
		} else if (!searchQuery && sortOption === "mostRelevant" && lastNonRelevantSort) {
			setSortOption(lastNonRelevantSort)
			setLastNonRelevantSort(null)
		}
	}, [searchQuery, sortOption, lastNonRelevantSort])

	const handleShowTaskWithId = useCallback((id: string) => {
		TaskServiceClient.showTaskWithId(StringRequest.create({ value: id })).catch((error) =>
			console.error("Error showing task:", error),
		)
	}, [])

	const handleHistorySelect = useCallback((itemId: string, checked: boolean) => {
		setSelectedItems((prev) => {
			if (checked) {
				return [...prev, itemId]
			} else {
				return prev.filter((id) => id !== itemId)
			}
		})
	}, [])

	const handleDeleteHistoryItem = useCallback(
		(id: string) => {
			TaskServiceClient.deleteTasksWithIds(StringArrayRequest.create({ value: [id] }))
				.then(() => fetchTotalTasksSize())
				.catch((error) => console.error("Error deleting task:", error))
		},
		[fetchTotalTasksSize],
	)

	const handleDeleteSelectedHistoryItems = useCallback(
		(ids: string[]) => {
			if (ids.length > 0) {
				TaskServiceClient.deleteTasksWithIds(StringArrayRequest.create({ value: ids }))
					.then(() => fetchTotalTasksSize())
					.catch((error) => console.error("Error deleting tasks:", error))
				setSelectedItems([])
			}
		},
		[fetchTotalTasksSize],
	)

	const formatDate = useCallback((timestamp: number) => {
		const date = new Date(timestamp)
		return date
			?.toLocaleString("en-US", {
				month: "long",
				day: "numeric",
				hour: "numeric",
				minute: "2-digit",
				hour12: true,
			})
			.replace(", ", " ")
			.replace(" at", ",")
		//.toUpperCase()
	}, [])

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

	const fuse = useMemo(() => {
		return new Fuse(tasks, {
			keys: ["task"],
			threshold: 0.6,
			shouldSort: true,
			isCaseSensitive: false,
			ignoreLocation: false,
			includeMatches: true,
			minMatchCharLength: 1,
		})
	}, [tasks])

	const taskHistorySearchResults = useMemo(() => {
		const results = searchQuery ? highlight(fuse.search(searchQuery)) : tasks

		results.sort((a, b) => {
			switch (sortOption) {
				case "oldest":
					return a.ts - b.ts
				case "mostExpensive":
					return (b.totalCost || 0) - (a.totalCost || 0)
				case "mostTokens":
					return (
						(b.tokensIn || 0) +
						(b.tokensOut || 0) +
						(b.cacheWrites || 0) +
						(b.cacheReads || 0) -
						((a.tokensIn || 0) + (a.tokensOut || 0) + (a.cacheWrites || 0) + (a.cacheReads || 0))
					)
				case "mostRelevant":
					// NOTE: you must never sort directly on object since it will cause members to be reordered
					return searchQuery ? 0 : b.ts - a.ts // Keep fuse order if searching, otherwise sort by newest
				case "newest":
				default:
					return b.ts - a.ts
			}
		})

		return results
	}, [tasks, searchQuery, fuse, sortOption])

	// Calculate total size of selected items
	const selectedItemsSize = useMemo(() => {
		if (selectedItems.length === 0) {
			return 0
		}

		return taskHistory.filter((item) => selectedItems.includes(item.id)).reduce((total, item) => total + (item.size || 0), 0)
	}, [selectedItems, taskHistory])

	const handleBatchHistorySelect = useCallback(
		(selectAll: boolean) => {
			if (selectAll) {
				setSelectedItems(taskHistorySearchResults.map((item) => item.id))
			} else {
				setSelectedItems([])
			}
		},
		[taskHistorySearchResults],
	)

	return (
		<>
			<style>
				{`
					.history-item {
						background-color: color-mix(in srgb, var(--vscode-toolbar-hoverBackground) 65%, transparent);
						border-radius: 8px;
						position: relative;
						overflow: hidden;
						cursor: pointer;
						margin-top: 0px;
						margin-bottom: 5px;
						margin-right: 10px;
						margin-left: 15px;

					}
					.history-item:hover {
						background-color: color-mix(in srgb, var(--vscode-toolbar-hoverBackground) 100%, transparent);
						opacity: 1;
						pointer-events: auto;
					}
					.delete-button, .export-button {
						opacity: 0;
						pointer-events: none;
					}
					.history-item:hover .delete-button,
					.history-item:hover .export-button {
						opacity: 1;
						pointer-events: auto;
					}
					.history-item-highlight {
						background-color: var(--vscode-editor-findMatchHighlightBackground);
						color: inherit;
					}
				`}
			</style>
			<div className="fixed overflow-hidden inset-0 flex flex-col">
				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						padding: "10px 17px 10px 20px",
					}}>
					<h3
						style={{
							color: getEnvironmentColor(environment),
							margin: 0,
						}}>
						Task History
					</h3>
					<VSCodeButton onClick={() => onDone()} style={{ height: "20px" }}>
						Done
					</VSCodeButton>
				</div>
				<div style={{ padding: "5px 17px 6px 17px" }}>
					<div className="flex flex-col gap-3">
						<VSCodeTextField
							onInput={(e) => {
								const newValue = (e.target as HTMLInputElement)?.value
								setSearchQuery(newValue)
								if (newValue && !searchQuery && sortOption !== "mostRelevant") {
									setLastNonRelevantSort(sortOption)
									setSortOption("mostRelevant")
								}
							}}
							placeholder="Search history..."
							style={{ width: "100%" }}
							value={searchQuery}>
							<div
								className="codicon codicon-search"
								slot="start"
								style={{
									fontSize: 13,
									marginTop: 2.5,
									opacity: 0.8,
								}}></div>
							{searchQuery && (
								<div
									aria-label="Clear search"
									className="input-icon-button codicon codicon-close"
									onClick={() => setSearchQuery("")}
									slot="end"
									style={{
										display: "flex",
										justifyContent: "center",
										alignItems: "center",
										height: "100%",
									}}
								/>
							)}
						</VSCodeTextField>
						<VSCodeRadioGroup
							className="flex flex-wrap"
							onChange={(e) => setSortOption((e.target as HTMLInputElement).value as SortOption)}
							value={sortOption}>
							<VSCodeRadio style={{ scale: "0.9" }} value="newest">
								Newest
							</VSCodeRadio>
							<VSCodeRadio style={{ scale: "0.9" }} value="oldest">
								Oldest
							</VSCodeRadio>
							<VSCodeRadio style={{ scale: "0.9" }} value="mostExpensive">
								Most Expensive
							</VSCodeRadio>
							<VSCodeRadio style={{ scale: "0.9" }} value="mostTokens">
								Most Tokens
							</VSCodeRadio>
							<VSCodeRadio
								disabled={!searchQuery}
								style={{ scale: "0.9", opacity: searchQuery ? 1 : 0.5 }}
								value="mostRelevant">
								Most Relevant
							</VSCodeRadio>
						</VSCodeRadioGroup>
						<div
							style={{
								display: "flex",
								flexWrap: "wrap",
							}}>
							<CustomFilterRadio
								checked={showCurrentWorkspaceOnly}
								icon=""
								label="Current Workspace"
								onChange={() => setShowCurrentWorkspaceOnly(!showCurrentWorkspaceOnly)}
							/>
							{/* <CustomFilterRadio
								checked={showFavoritesOnly}
								icon=""
								label="Favorites"
								onChange={() => setShowFavoritesOnly(!showFavoritesOnly)}
							/> */}
						</div>
						{/* <div
							style={{
								margin: "5px 5px",
								gap: "5px",
								display: "flex",
								height: "20px",
								justifyContent: "flex-start",
							}}>
							<VSCodeButton
								appearance="icon"
								className={`
									bg-[var(--vscode-input-background)]
									text-[var(--vscode-input-foreground)]
								`}
								onClick={() => {
									handleBatchHistorySelect(true)
								}}>
								Select All
							</VSCodeButton>
							<VSCodeButton
								appearance="icon"
								className={`
									bg-[var(--vscode-input-background)]
									text-[var(--vscode-input-foreground)]
								`}
								onClick={() => {
									handleBatchHistorySelect(false)
								}}>
								Select None
							</VSCodeButton>
						</div> */}
					</div>
				</div>
				<div style={{ flexGrow: 1, overflowY: "auto", margin: 0 }}>
					<Virtuoso
						data={taskHistorySearchResults}
						itemContent={(_index, item) => (
							<div
								className="history-item"
								key={item.id}
								style={{
									borderColor: selectedItems.includes(item.id) ? "var(--vscode-focusBorder)" : undefined,
									border: selectedItems.includes(item.id) ? "0.5px dotted" : undefined,
									cursor: "pointer",
									display: "flex",
								}}>
								<VSCodeCheckbox
									checked={selectedItems.includes(item.id)}
									className="pl-2 pr-0 py-auto"
									onClick={(e) => {
										const checked = (e.target as HTMLInputElement).checked
										handleHistorySelect(item.id, checked)
										e.stopPropagation()
									}}
									style={{ scale: "0.9" }}
								/>
								<div
									onClick={() => handleShowTaskWithId(item.id)}
									style={{
										overflow: "auto",
										display: "flex",
										flexDirection: "column",
										gap: "0px",
										padding: "0px 5px 0px 8px",
										position: "relative",
										flexGrow: 1,
									}}>
									<div
										style={{
											display: "flex",
											alignItems: "center",
											gap: "8px",
										}}>
										<div
											style={{
												color: "var(--vscode-descriptionForeground)",
												opacity: 0.7,
												fontWeight: 400,
												fontSize: "0.95em",
												flex: 1,
												overflow: "hidden",
												textOverflow: "ellipsis",
												whiteSpace: "nowrap",
											}}>
											<span>{formatTime(item.ts)}</span>
											{" - "}
											{formatDate(item.ts)}
										</div>
										<div style={{ display: "flex", gap: "4px" }}>
											{/* only show delete button if task not favorited */}
											{!(pendingFavoriteToggles[item.id] ?? item.isFavorited) && (
												<VSCodeButton
													appearance="icon"
													aria-label="Delete"
													className="delete-button"
													onClick={(e) => {
														e.stopPropagation()
														handleDeleteHistoryItem(item.id)
													}}
													style={{ padding: "0px 0px" }}>
													<div
														style={{
															display: "flex",
															alignItems: "center",
															gap: "3px",
															fontSize: "10px",
														}}>
														<span
															className="codicon codicon-trash"
															style={{ fontSize: "13px" }}></span>
														{formatSize(item.size)}
													</div>
												</VSCodeButton>
											)}
											{/* <VSCodeButton
												appearance="icon"
												aria-label={item.isFavorited ? "Remove from favorites" : "Add to favorites"}
												onClick={(e) => {
													e.stopPropagation()
													toggleFavorite(item.id, item.isFavorited || false)
												}}
												style={{ padding: "0px", marginTop: "-2px" }}>
												<div
													className={`codicon ${
														pendingFavoriteToggles[item.id] !== undefined
															? pendingFavoriteToggles[item.id]
																? "codicon-star-full"
																: "codicon-star-empty"
															: item.isFavorited
																? "codicon-star-full"
																: "codicon-star-empty"
													}`}
													style={{
														color:
															(pendingFavoriteToggles[item.id] ?? item.isFavorited)
																? "var(--vscode-button-background)"
																: "inherit",
														opacity: (pendingFavoriteToggles[item.id] ?? item.isFavorited) ? 1 : 0.7,
														display:
															(pendingFavoriteToggles[item.id] ?? item.isFavorited)
																? "block"
																: undefined,
														fontSize: "13px",
													}}
												/>
											</VSCodeButton> */}
										</div>
									</div>

									<div style={{ marginBottom: "2px", position: "relative" }}>
										<div
											style={{
												fontSize: "13px",
												fontWeight: 500,
												opacity: 0.8,
												marginBottom: "4px",
												color: "var(--vscode-foreground)",
												display: "-webkit-box",
												WebkitLineClamp: 2,
												WebkitBoxOrient: "vertical",
												overflow: "hidden",
												whiteSpace: "pre-wrap",
												wordBreak: "break-word",
												overflowWrap: "anywhere",
											}}>
											<span
												className="ph-no-capture"
												dangerouslySetInnerHTML={{
													__html: item.task,
												}}
											/>
										</div>
									</div>
									{item.modelId && (
										<div className="text-description -mt-1.5 mb-1 opacity-80" style={{ fontSize: "0.9em" }}>
											Model: {item.modelId}
										</div>
									)}
									<div
										style={{
											display: "flex",
											flexDirection: "column",
											gap: "4px",
											marginTop: "-5px",
										}}>
										<div
											style={{
												display: "flex",
												justifyContent: "space-between",
												alignItems: "center",
												opacity: 0.8,
												fontSize: "0.9em",
												overflow: "hidden",
											}}>
											<div
												style={{
													display: "flex",
													alignItems: "center",
													gap: "4px",
													flexWrap: "wrap",
												}}>
												<span
													style={{
														fontWeight: 500,
														color: "var(--vscode-descriptionForeground)",
													}}>
													Tokens:
												</span>
												<span
													style={{
														display: "flex",
														alignItems: "center",
														gap: "3px",
														color: "var(--vscode-descriptionForeground)",
													}}>
													<i
														className="codicon codicon-arrow-up"
														style={{
															fontSize: "12px",
															fontWeight: "bold",
															// marginBottom: "-2px",
														}}
													/>
													{formatLargeNumber(item.tokensIn || 0)}
												</span>
												<span
													style={{
														display: "flex",
														alignItems: "center",
														gap: "3px",
														color: "var(--vscode-descriptionForeground)",
													}}>
													<i
														className="codicon codicon-arrow-down"
														style={{
															fontSize: "12px",
															fontWeight: "bold",
															marginBottom: "-2px",
														}}
													/>
													{formatLargeNumber(item.tokensOut || 0)}
												</span>
											</div>
											{!item.totalCost && <ExportButton itemId={item.id} />}
										</div>

										{/* {!!(item.cacheWrites || item.cacheReads) && (
											<div
												style={{
													display: "flex",
													alignItems: "center",
													gap: "4px",
													flexWrap: "wrap",
													fontSize: "0.9em",
													opacity: 0.7,
												}}>
												<span
													style={{
														fontWeight: 500,
														color: "var(--vscode-descriptionForeground)",
													}}>
													Cache:
												</span>
												{item.cacheWrites > 0 && (
													<span
														style={{
															display: "flex",
															alignItems: "center",
															gap: "3px",
															color: "var(--vscode-descriptionForeground)",
														}}>
														<i
															className="codicon codicon-arrow-right"
															style={{
																fontSize: "12px",
																fontWeight: "bold",
																marginBottom: "-1px",
															}}
														/>
														{formatLargeNumber(item.cacheWrites)}
													</span>
												)}
												{item.cacheReads > 0 && (
													<span
														style={{
															display: "flex",
															alignItems: "center",
															gap: "3px",
															color: "var(--vscode-descriptionForeground)",
														}}>
														<i
															className="codicon codicon-arrow-left"
															style={{
																fontSize: "12px",
																fontWeight: "bold",
																marginBottom: 0,
															}}
														/>
														{formatLargeNumber(item.cacheReads)}
													</span>
												)}
											</div>
										)} */}
										{/* {item.modelId && <div className="text-description text-sm -mt-1 opacity-80">Model: {item.modelId}</div>} */}
										{!!item.totalCost && (
											<div
												style={{
													display: "flex",
													justifyContent: "space-between",
													alignItems: "center",
													marginTop: -5,
													fontSize: "0.9em",
													opacity: 0.7,
												}}>
												<div
													style={{
														display: "flex",
														alignItems: "center",
														gap: "4px",
													}}>
													<span
														style={{
															fontWeight: 500,
															color: "var(--vscode-descriptionForeground)",
														}}>
														Cost:
													</span>
													<span
														style={{
															color: "var(--vscode-descriptionForeground)",
														}}>
														${item.totalCost?.toFixed(4)}
													</span>
												</div>
												<ExportButton itemId={item.id} />
											</div>
										)}
									</div>
								</div>
							</div>
						)}
						style={{
							flexGrow: 1,
							overflowY: "scroll",
						}}
					/>
				</div>
				<div
					style={{
						padding: "10px 20px 10px 15px",
						//borderTop: "1px solid var(--vscode-panel-border)",
					}}>
					<div className="flex gap-2.5 mb-1.5">
						<VSCodeButton
							appearance="icon"
							className={`
									bg-[var(--vscode-input-background)]
									text-[var(--vscode-input-foreground)]
								`}
							onClick={() => handleBatchHistorySelect(true)}
							style={{ flex: 1 }}>
							Select All
						</VSCodeButton>
						<VSCodeButton
							appearance="icon"
							className={`
									bg-[var(--vscode-input-background)]
									text-[var(--vscode-input-foreground)]
								`}
							onClick={() => handleBatchHistorySelect(false)}
							style={{ flex: 1 }}>
							Select None
						</VSCodeButton>
					</div>
					{selectedItems.length > 0 ? (
						<DangerButton
							aria-label="Delete selected items"
							onClick={() => {
								handleDeleteSelectedHistoryItems(selectedItems)
							}}
							style={{ width: "100%" }}>
							Delete {selectedItems.length > 1 ? selectedItems.length : ""} Selected
							{selectedItemsSize > 0 ? ` (${formatSize(selectedItemsSize)})` : ""}
						</DangerButton>
					) : (
						<DangerButton
							aria-label="Delete all history"
							disabled={deleteAllDisabled || taskHistory.length === 0}
							onClick={() => {
								setDeleteAllDisabled(true)
								TaskServiceClient.deleteAllTaskHistory(BooleanRequest.create({}))
									.then(() => fetchTotalTasksSize())
									.catch((error) => console.error("Error deleting task history:", error))
									.finally(() => setDeleteAllDisabled(false))
							}}
							style={{ width: "100%" }}>
							Delete All History{totalTasksSize !== null ? ` (${formatSize(totalTasksSize)})` : ""}
						</DangerButton>
					)}
				</div>
			</div>
		</>
	)
}

const ExportButton = ({ itemId }: { itemId: string }) => (
	<VSCodeButton
		appearance="icon"
		aria-label="Export"
		className="export-button"
		onClick={(e) => {
			e.stopPropagation()
			TaskServiceClient.exportTaskWithId(StringRequest.create({ value: itemId })).catch((err) =>
				console.error("Failed to export task:", err),
			)
		}}>
		<div style={{ fontSize: "11px", fontWeight: 500, opacity: 1 }}>EXPORT</div>
	</VSCodeButton>
)

// https://gist.github.com/evenfrost/1ba123656ded32fb7a0cd4651efd4db0
export const highlight = (fuseSearchResult: FuseResult<any>[], highlightClassName: string = "history-item-highlight") => {
	const set = (obj: Record<string, any>, path: string, value: any) => {
		const pathValue = path.split(".")
		let i: number

		for (i = 0; i < pathValue.length - 1; i++) {
			obj = obj[pathValue[i]] as Record<string, any>
		}

		obj[pathValue[i]] = value
	}

	// Function to merge overlapping regions
	const mergeRegions = (regions: [number, number][]): [number, number][] => {
		if (regions.length === 0) {
			return regions
		}

		// Sort regions by start index
		regions.sort((a, b) => a[0] - b[0])

		const merged: [number, number][] = [regions[0]]

		for (let i = 1; i < regions.length; i++) {
			const last = merged[merged.length - 1]
			const current = regions[i]

			if (current[0] <= last[1] + 1) {
				// Overlapping or adjacent regions
				last[1] = Math.max(last[1], current[1])
			} else {
				merged.push(current)
			}
		}

		return merged
	}

	const generateHighlightedText = (inputText: string, regions: [number, number][] = []) => {
		if (regions.length === 0) {
			return inputText
		}

		// Sort and merge overlapping regions
		const mergedRegions = mergeRegions(regions)

		let content = ""
		let nextUnhighlightedRegionStartingIndex = 0

		mergedRegions.forEach((region) => {
			const start = region[0]
			const end = region[1]
			const lastRegionNextIndex = end + 1

			content += [
				inputText.substring(nextUnhighlightedRegionStartingIndex, start),
				`<span class="${highlightClassName}">`,
				inputText.substring(start, lastRegionNextIndex),
				"</span>",
			].join("")

			nextUnhighlightedRegionStartingIndex = lastRegionNextIndex
		})

		content += inputText.substring(nextUnhighlightedRegionStartingIndex)

		return content
	}

	return fuseSearchResult
		.filter(({ matches }) => matches && matches.length)
		.map(({ item, matches }) => {
			const highlightedItem = { ...item }

			matches?.forEach((match) => {
				if (match.key && typeof match.value === "string" && match.indices) {
					// Merge overlapping regions before generating highlighted text
					const mergedIndices = mergeRegions([...match.indices])
					set(highlightedItem, match.key, generateHighlightedText(match.value, mergedIndices))
				}
			})

			return highlightedItem
		})
}

export default memo(HistoryView)
