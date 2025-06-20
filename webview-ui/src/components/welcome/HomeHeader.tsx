import AgentLogo from "@/assets/AgentLogo"
import ClineLogoVariable from "@/assets/ClineLogoVariable"
import HeroTooltip from "@/components/common/HeroTooltip"
import { agentName } from "@shared/Configuration"
import { useState, useEffect } from "react"

const HomeHeader = () => {
	const [isExpanded, setIsExpanded] = useState(() => {
		try {
			const saved = localStorage.getItem("homeHeader-isExpanded")
			return saved ? JSON.parse(saved) : false
		} catch (error) {
			console.warn("Failed to read homeHeader expansion state from localStorage:", error)
			return false
		}
	})

	// Save to localStorage whenever isExpanded changes
	useEffect(() => {
		try {
			localStorage.setItem("homeHeader-isExpanded", JSON.stringify(isExpanded))
		} catch (error) {
			console.warn("Failed to save homeHeader expansion state to localStorage:", error)
		}
	}, [isExpanded])

	const toggleExpanded = () => {
		setIsExpanded(!isExpanded)
	}

	return (
		<div style={{ flexShrink: 0 }}>
			<style>
				{`
					.info-header {
						cursor: pointer;
						user-select: none;
					}
					.info-header:hover {
						opacity: 0.8;
					}
				`}
			</style>

			<div
				className="info-header"
				onClick={toggleExpanded}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault()
						toggleExpanded()
					}
				}}
				role="button"
				tabIndex={0}
				aria-expanded={isExpanded}
				aria-label={`${isExpanded ? "Collapse" : "Expand"} overview section`}
				style={{
					color: "var(--vscode-descriptionForeground)",
					margin: "20px 20px 10px 20px",
					display: "flex",
					alignItems: "center",
				}}>
				<span
					className={`codicon codicon-chevron-${isExpanded ? "down" : "right"}`}
					style={{
						marginRight: "2px",
						transform: "scale(0.9)",
					}}></span>
				<span
					className="codicon codicon-info"
					style={{
						marginRight: "4px",
						transform: "scale(0.9)",
					}}></span>
				<span
					style={{
						fontWeight: 600,
						fontSize: "0.85em",
						textTransform: "uppercase",
					}}>
					Overview
				</span>
			</div>

			{isExpanded && (
				<div
					style={{
						paddingLeft: "0px",
						paddingRight: "5px",
						paddingBottom: "0px",
						marginLeft: "20px",
						marginRight: "0px",
					}}>
					<div>
						<div
							style={{
								//display: "flex",
								//flexDirection: "column",
								alignItems: "left",
								textAlign: "left",
								//maxWidth: "350px",
							}}>
							<p
								style={{
									fontSize: "12px",
									lineHeight: "15px",
									marginLeft: "15px",
									marginRight: "15px",
									opacity: 0.9,
								}}>
								<div style={{ marginLeft: "-10px", marginBottom: "10px" }}>
									<strong>{agentName}</strong> can help with many tasks. This is a high level overview of how to
									use it:
								</div>
								<ul style={{ listStyleType: "disc", paddingLeft: 0, marginBlockStart: 0, marginBlockEnd: 0 }}>
									<style>
										{`
											ul > li {
												margin-bottom: 10px;
											}
										`}
									</style>
									<li>
										Use Plan mode to create and refine a plan and Act mode to execute. You can configure
										different models for each mode in settings.
									</li>
									<li>
										Type "@" in the chat to add files, folders, terminal output, code problems, etc. to the
										task context.
									</li>
									<li>Type "/" in the chat to execute build-in commands or invoke workflows.</li>
									<li>
										Use autogenerated checkpoints in tasks to restore the workspace to specific points. Edit a
										previous task message to restart from that point.
									</li>
									<li>
										Start a new task each time you have a new scope. Keep your task context specific to the
										same scope. Type "/newtask" to start a new task with a context summary from the current
										task, when you want to explore a new scope that needs context.
									</li>
									<li>
										Use task history to search and manage previous tasks. Switch between tasks at any time.
									</li>
									<li>
										Use chat bar controls to manage auto-approve actions, activate or deactivate MCP servers,
										instruction files or workflows. You can also change the provider and model used to execute
										task requests and add pictures or files to capable models.
									</li>
									<li>
										Use top bar controls to start a new task, manage task history, MCP servers, access general
										settings, and open new instances.
									</li>
								</ul>
							</p>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}

export default HomeHeader
