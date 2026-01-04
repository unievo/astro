import { agentName, baseName, baseVersion, baseVersionUrl, discordUrl, repoUrl, xUrl } from "@shared/Configuration"
import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import Section from "../Section"

interface AboutSectionProps {
	version: string
	renderSectionHeader: (tabId: string) => JSX.Element | null
}
const AboutSection = ({ version, renderSectionHeader }: AboutSectionProps) => {
	return (
		<div>
			{renderSectionHeader("about")}
			<Section>
				<div className="leading-[1.4]">
					<div style={{ textAlign: "center", fontSize: "18px", fontWeight: "bold" }}>
						<p>{agentName}</p>
					</div>
					<div>
						<p className="text-center -mt-3 mb-7 p-0">v{version}</p>
					</div>
					<div style={{ marginRight: "-10px" }}>
						<p>
							Astro is a foundation for custom AI software agents that can have specialized functionalities,
							features and capabilities.
						</p>
						<p>If you have any issues, questions or feedback, feel free to contact us on:</p>
						<p style={{ margin: "0 0 0 5px", fontSize: "13px", textAlign: "center" }}>
							<VSCodeLink href={repoUrl}>GitHub</VSCodeLink>
							{xUrl && (
								<span>
									{" | "}
									<VSCodeLink href={xUrl}>X.com</VSCodeLink>
								</span>
							)}
							{discordUrl && (
								<span>
									{" | "}
									<VSCodeLink href={discordUrl}>Discord</VSCodeLink>
								</span>
							)}
						</p>
					</div>
					<br />
					<br />
					{baseName && (
						<div>
							<p className="text-center text-sm mt-5 mb-0 p-0">Base Version</p>
							<p className="text-center mt-2 mb-0 p-0">
								<a href={baseVersionUrl}>
									{baseName} {baseVersion}
								</a>
							</p>
						</div>
					)}
				</div>
			</Section>
		</div>
	)
}

export default AboutSection
