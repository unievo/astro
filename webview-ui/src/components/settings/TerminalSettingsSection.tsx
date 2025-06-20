import React, { useState } from "react"
import { VSCodeTextField, VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { agentName } from "@shared/Configuration"

export const TerminalSettingsSection: React.FC = () => {
	const { shellIntegrationTimeout, setShellIntegrationTimeout, terminalReuseEnabled, setTerminalReuseEnabled } =
		useExtensionState()
	const [inputValue, setInputValue] = useState((shellIntegrationTimeout / 1000).toString())
	const [inputError, setInputError] = useState<string | null>(null)

	const handleTimeoutChange = (event: Event) => {
		const target = event.target as HTMLInputElement
		const value = target.value

		setInputValue(value)

		const seconds = parseFloat(value)
		if (isNaN(seconds) || seconds <= 0) {
			setInputError("Please enter a positive number")
			return
		}

		setInputError(null)
		const timeout = Math.round(seconds * 1000) // Convert to milliseconds

		// Update local state
		setShellIntegrationTimeout(timeout)
	}

	const handleInputBlur = () => {
		// If there was an error, reset the input to the current valid value
		if (inputError) {
			setInputValue((shellIntegrationTimeout / 1000).toString())
			setInputError(null)
		}
	}

	const handleTerminalReuseChange = (event: Event) => {
		const target = event.target as HTMLInputElement
		const checked = target.checked

		// Update local state
		setTerminalReuseEnabled(checked)

		// TODO: Send to extension using gRPC when the backend is ready
		// For now, we'll just update the local state
	}

	return (
		<div id="terminal-settings-section" style={{ marginBottom: 20 }}>
			<div style={{ marginBottom: 15 }}>
				<div style={{ marginBottom: 8 }}>
					<label style={{ fontWeight: "500", display: "block", marginBottom: 5 }}>
						Shell integration timeout (seconds)
					</label>
					<div style={{ display: "flex", alignItems: "center" }}>
						<VSCodeTextField
							style={{ width: "100px" }}
							value={inputValue}
							placeholder="timeout"
							onChange={(event) => handleTimeoutChange(event as Event)}
							onBlur={handleInputBlur}
						/>
					</div>
					{inputError && (
						<div style={{ color: "var(--vscode-errorForeground)", fontSize: "12px", marginTop: 5 }}>{inputError}</div>
					)}
				</div>
				<p style={{ fontSize: "12px", color: "var(--vscode-descriptionForeground)", margin: 0 }}>
					Set how long {agentName} waits for shell integration to activate before executing commands. Increase this
					value if you experience terminal connection timeouts.
				</p>
			</div>

			<div style={{ marginBottom: 15 }}>
				<div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
					<VSCodeCheckbox
						checked={terminalReuseEnabled ?? true}
						onChange={(event) => handleTerminalReuseChange(event as Event)}>
						Enable terminal reuse
					</VSCodeCheckbox>
				</div>
				<p style={{ fontSize: "12px", color: "var(--vscode-descriptionForeground)", margin: 0 }}>
					When enabled, {agentName} will reuse existing terminal windows that aren't in the current working directory.
					Disable this if you experience issues with task lockout after a terminal command.
				</p>
			</div>
		</div>
	)
}

export default TerminalSettingsSection
