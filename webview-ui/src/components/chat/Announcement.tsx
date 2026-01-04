import { discordUrl, repoUrl, xUrl } from "@shared/Configuration"
import { VSCodeButton, VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { CSSProperties, memo } from "react"
import { getAsVar, VSC_DESCRIPTION_FOREGROUND, VSC_INPUT_BACKGROUND } from "@/utils/vscStyles"
import { defaultBorderRadius } from "../config"

interface AnnouncementProps {
	version: string
	hideAnnouncement: () => void
}

const containerStyle: CSSProperties = {
	backgroundColor: getAsVar(VSC_INPUT_BACKGROUND),
	borderRadius: defaultBorderRadius,
	padding: "5px",
	margin: "5px 1px 5px 17px",
	position: "relative",
	flexShrink: 0,
}
const closeIconStyle: CSSProperties = { position: "absolute", top: "4px", right: "4px" }
const h3TitleStyle: CSSProperties = { margin: "0px 5px", fontSize: "14px", fontWeight: "normal" }
const h4TitleStyle: CSSProperties = { margin: "0 0 8px", fontWeight: "bold" }
const ulStyle: CSSProperties = { fontSize: "12px", listStyle: "disc", margin: "4px", marginBottom: "-10px", paddingLeft: "10px" }
const _accountIconStyle: CSSProperties = { fontSize: 11 }
const hrStyle: CSSProperties = {
	height: "1px",
	background: getAsVar(VSC_DESCRIPTION_FOREGROUND),
	opacity: 0.1,
	marginTop: "5px",
	marginBottom: "5px",
}
const linkContainerStyle: CSSProperties = { margin: "0 0 0 5px", fontSize: "12px", textAlign: "left" }
const linkStyle: CSSProperties = { display: "inline", fontSize: "11px" }

/*
Announcements are automatically shown when the major.minor version changes (for ex 3.19.x → 3.20.x or 4.0.x). 
The latestAnnouncementId is now automatically generated from the extension's package.json version. 
Patch releases (3.19.1 → 3.19.2) will not trigger new announcements.
*/
const Announcement = ({ version, hideAnnouncement }: AnnouncementProps) => {
	const minorVersion = version.split(".").slice(0, 2).join(".") // 2.0.0 -> 2.0

	// const isVscode = PLATFORM_CONFIG.type === PlatformType.VSCODE

	return (
		<div style={containerStyle}>
			<VSCodeButton appearance="icon" data-testid="close-button" onClick={hideAnnouncement} style={closeIconStyle}>
				<span className="codicon codicon-close"></span>
			</VSCodeButton>
			{/* <span className="codicon codicon-info" style={{ marginLeft: "0px", fontSize: "20px" }}></span> */}
			<div style={h3TitleStyle}>
				Release <a href="https://github.com/unievo/astro/blob/main/CHANGELOG.md">v{minorVersion}</a>
			</div>
			{/* {
				<ul style={ulStyle}>
					<li>GPT-5.2, Gemini 3 Flash Preview</li>
					<li>New free models in the Cline provider</li>
					<div className="mt-2" />
					<b style={{ fontSize: 12 }}>
						Features Update: <a href={`${baseVersionUrl}`}>{baseVersion}</a>
					</b>
				</ul>
			} */}

			{/* <Accordion className="" isCompact>
				<AccordionItem
					aria-label="Previous Updates"
					classNames={{
						trigger: "bg-transparent border-0 pl-0 pb-0 w-fit",
						title: "font-bold text-sm text-[var(--vscode-foreground)]",
						indicator:
							"text-[var(--vscode-foreground)] -rotate-180 data-[open=true]:-rotate-90 rtl:rotate-0 rtl:data-[open=true]:-rotate-90",
					}}
					key="1"
					style={{ margin: "15px 8px 0" }}
					title="Previous Updates:">
					<ul style={ulStyle}>
						<li>
							<b>On demand MCP tools schema loading:</b> performance and cost optimization when using MCP servers
							with a large number of tools, reducing the system prompt size and token usage.
						</li>
					</ul>
				</AccordionItem>
			</Accordion> */}
			<div style={hrStyle} />
			<p style={linkContainerStyle}>
				<VSCodeLink href={repoUrl} style={linkStyle}>
					GitHub
				</VSCodeLink>
				{xUrl && (
					<span>
						{" | "}
						<VSCodeLink href={xUrl} style={linkStyle}>
							X.com
						</VSCodeLink>
					</span>
				)}

				{discordUrl && (
					<span>
						{" | "}
						<VSCodeLink href={discordUrl} style={linkStyle}>
							Discord
						</VSCodeLink>
					</span>
				)}
			</p>
		</div>
	)
}

export default memo(Announcement)
