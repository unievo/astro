import { VSCodeButton, VSCodeLink, VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import { useEffect, useState, useCallback } from "react"
import { useExtensionState } from "../../context/ExtensionStateContext"
import { validateApiConfiguration } from "../../utils/validate"
import { vscode } from "../../utils/vscode"
import ApiOptions from "../settings/ApiOptions"
import { useEvent } from "react-use"
import { ExtensionMessage } from "../../../../src/shared/ExtensionMessage"
import { agentName } from "../../../../src/shared/Configuration"

const WelcomeView = () => {
	const { apiConfiguration } = useExtensionState()

	const [apiErrorMessage, setApiErrorMessage] = useState<string | undefined>(undefined)
	const [email, setEmail] = useState("")
	const [isSubscribed, setIsSubscribed] = useState(false)

	const disableLetsGoButton = apiErrorMessage != null

	const handleSubmit = () => {
		vscode.postMessage({ type: "apiConfiguration", apiConfiguration })
	}

	const handleSubscribe = () => {
		if (email) {
			vscode.postMessage({ type: "subscribeEmail", text: email })
		}
	}

	useEffect(() => {
		setApiErrorMessage(validateApiConfiguration(apiConfiguration))
	}, [apiConfiguration])

	// Add message handler for subscription confirmation
	const handleMessage = useCallback((e: MessageEvent) => {
		const message: ExtensionMessage = e.data
		if (message.type === "emailSubscribed") {
			setIsSubscribed(true)
			setEmail("")
		}
	}, [])

	useEvent("message", handleMessage)

	return (
		<div
			style={{
				position: "fixed",
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
			}}>
			<div
				style={{
					height: "100%",
					padding: "0 20px",
					overflow: "auto",
				}}>
				<h2>Hi, I'm {agentName}</h2>
				<p>
					I can do all kinds of tasks{" "}
					{/* thanks to the latest breakthroughs in{" "}
					<VSCodeLink
						href="https://www-cdn.anthropic.com/fed9cc193a14b84131812372d8d5857f8f304c52/Model_Card_Claude_3_Addendum.pdf"
						style={{ display: "inline" }}>
						Claude 3.5 Sonnet's agentic coding capabilities
					</VSCodeLink>{" "} */}
					and access tools that let me create & edit files, explore complex projects, use the browser, and execute
					terminal commands (with your permission, of course). I can even use MCP to create new tools and extend my own
					capabilities.
				</p>

				<b>To get started, I need access to an AI API provider.</b>

				{/* <div
					style={{
						marginTop: "15px",
						padding: isSubscribed ? "5px 15px 5px 15px" : "12px",
						background: "var(--vscode-textBlockQuote-background)",
						borderRadius: "6px",
						fontSize: "0.9em",
					}}>
					{isSubscribed ? (
						<p style={{ display: "flex", alignItems: "center", gap: "8px" }}>
							<span style={{ color: "var(--vscode-testing-iconPassed)", fontSize: "1.5em" }}>✓</span>
							Thanks for subscribing! We'll keep you updated on new features.
						</p>
					) : (
						<>
							<p style={{ margin: 0, marginBottom: "8px" }}>
								While Cline currently requires you bring your own API key, we are working on an official accounts
								system with additional capabilities. Subscribe to our mailing list to get updates!
							</p>
							<div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
								<VSCodeTextField
									type="email"
									value={email}
									onInput={(e: any) => setEmail(e.target.value)}
									placeholder="Enter your email"
									style={{ flex: 1 }}
								/>
								<VSCodeButton appearance="secondary" onClick={handleSubscribe} disabled={!email}>
									Subscribe
								</VSCodeButton>
							</div>
						</>
					)}
				</div> */}

				<div style={{ marginTop: "15px" }}>
					<ApiOptions showModelOptions={false} />
					<VSCodeButton onClick={handleSubmit} disabled={disableLetsGoButton} style={{ marginTop: "3px" }}>
						Let's go!
					</VSCodeButton>
				</div>
			</div>
		</div>
	)
}

export default WelcomeView
