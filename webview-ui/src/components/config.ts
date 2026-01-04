import { ClineAsk, ClineSay } from "@shared/ExtensionMessage"
import { useEffect, useState } from "react"
import { keyframes } from "styled-components"

// Message types that should default to expanded state
// These types apply to both message.say and message.ask properties
export const defaultExpandedMessageTypes: (ClineSay | ClineAsk)[] = [
	"plan_mode_respond",
	"mcp_notification",
	"text",
	// "reasoning",
	"completion_result",
]

// Show text response header only if text message type is not expanded by default
export const showTextResponseHeader = !defaultExpandedMessageTypes.includes("text")

// Chat settings
export const hideApiRequestCompletedRow = true
export const hideResponseRow = false
export const hideReasoningRow = false
export const responseTextLineClamp = 3
export const rowIconVisible = true

// General settings
export const defaultBorderRadius = 6
export const chatFooterEmptyHeight = 100

// Opacity
export const primaryOpacity = 1
export const secondaryOpacity = 1

// Colors
export const primaryColor = "var(--vscode-foreground)"
export const secondaryColor = "var(--vscode-descriptionForeground)"

export const normalColor = primaryColor
export const warningColor = "var(--vscode-editorWarning-foreground)"
export const errorColor = "var(--vscode-errorForeground)"
export const successColor = "var(--vscode-charts-green)"
export const linkColor = "var(--vscode-textLink-foreground)"

// Text
export const primaryFontSize = 13
export const secondaryFontSize = primaryFontSize - 1
export const menuFontSize = primaryFontSize - 1
export const codeBlockFontSize = primaryFontSize - 2
export const textLineHeight = 1.5

// Icons
export const iconHighlightColor = "color-mix(in srgb, var(--vscode-focusBorder) 60%, var(--vscode-editor-foreground))"
export const rowIconOpacity = primaryOpacity - 0.2
export const rowIconFontSize = primaryFontSize

// Chat input section
export const chatInputSectionMargin = "3px 8px 6px 7px"
export const chatInputSectionBackground =
	"color-mix(in srgb, var(--vscode-editor-background) 92%, var(--vscode-editor-foreground))"
export const chatInputSectionQuoteBackground = `color-mix(in srgb, ${chatInputSectionBackground} 93%, var(--vscode-editor-foreground))`
export const chatInputSectionBorder =
	"1px solid color-mix(in srgb, var(--vscode-editorWidget-border) 70%, var(--vscode-editor-background))"

// Task header
export const taskHeaderTextLineClamp = 2
export const taskHeaderTokenUsageVisible = true
export const taskHeaderTaskTimelineVisible = false
export const taskHeaderTimelineHeight = 12
export const taskHeaderTimelineBlockWidth = 8
export const taskHeaderTimelineBlockGap = 1
export const taskHeaderTimelineBlockBorderRadius = 2
export const taskHeaderBackground = chatInputSectionBackground

// Checkpoints
export const checkPointContainerMinHeight = 30
export const checkPointContainerMargin = "0px 5px 0px 0px"
export const checkPointContainerNormalOpacity = rowIconOpacity - 0.3
export const checkPointContainerHoverOpacity = rowIconOpacity
export const checkPointIconSize = rowIconFontSize - 2
export const checkPointLineNormalOpacity = 0.2

// Tools
export const toolBorder = "0.5px solid var(--vscode-editorWidget-border)"
export const toolBackground = `color-mix(in srgb, var(--vscode-editor-foreground) 15%, var(--vscode-editor-background))`

// Chat row
export const rowPaddingTop = 4
export const rowPaddingBottom = rowPaddingTop
export const rowPaddingLeft = 13
export const rowPaddingRight = 6
export const rowHeaderGap = 5
export const spacingContainerMarginTop = 5
export const spacingContainerMarginBottom = 2

// Row Item
export const rowItemBorder = `0.5px solid ${toolBackground}`
export const rowItemExpandedBackground = `color-mix(in srgb, ${toolBackground} 60%, var(--vscode-editor-background))`
export const rowItemHoverBackground = toolBackground
export const rowItemPadding = "0px 3px"
export const rowItemExpandedPadding = "3px 3px"
export const rowItemExpandedTopMargin = 1
export const rowItemExpandedMaxHeight = 250
export const rowItemMultilineMargin = 8
export const rowItemPrimaryOpacity = primaryOpacity
export const rowItemSecondaryOpacity = secondaryOpacity
export const rowItemDisabledOpacity = rowItemSecondaryOpacity - 0.2
export const rowItemBackgroundOpacity = rowItemSecondaryOpacity - 0.6
export const rowItemExpandedOpacity = rowItemPrimaryOpacity + 0.1
export const rowItemFullFilePath = false
export const rowItemLeadingPathSeparator = false

// Menus
export const menuTopBorder = `1px solid color-mix(in srgb, var(--vscode-editorWidget-border) 90%, transparent)`
export const menuBackground = `color-mix(in srgb, ${chatInputSectionBackground} 97%, var(--vscode-editor-foreground))`
export const menuRowBackground = `color-mix(in srgb, ${chatInputSectionBackground} 80%, var(--vscode-editor-foreground))`
export const menuRowDetailsBackground = `color-mix(in srgb, ${menuRowBackground} 50%, var(--vscode-editor-background))`
export const menuRowDisabledBackground = `color-mix(in srgb, ${menuRowBackground} 70%, var(--vscode-editor-background))`

// Approval container
export const approvalContainerBorder = "1px solid var(--vscode-inputOption-activeBorder)"
export const approvalMessageFontSize = secondaryFontSize - 1
export const approvalMessageMargin = "0px 0px 0px 0px"
export const approvalMessageColor = `color-mix(in srgb, var(--vscode-editorWarning-foreground) 80%, var(--vscode-editor-background))`

// Option buttons
export const optionBackground = `color-mix(in srgb, ${chatInputSectionBackground} 90%, var(--vscode-editor-foreground))`
export const optionSelectedBackground = `color-mix(in srgb, ${optionBackground} 70%, var(--vscode-editor-foreground))`
export const optionBorder = "1px solid var(--vscode-editorGroup-border)"
export const optionPadding = "3px 15px"

// Response text
export const responseContainerCollapsedMargin = "5px 4px 4px 0px"
export const responseContainerExpandedMargin = "5px 0px 4px 0px"
export const responseTextFontSize = primaryFontSize
export const responseTextCollapsedOpacity = rowItemBackgroundOpacity

// Completion message
export const completionRowMargin = "20px 0px 10px 0px"
export const completionTextMargin = "20px 0px 0px 0px"

// User message
export const userMessageTextColor = "var(--vscode-foreground)"
export const userMessageBackground = "color-mix(in srgb, var(--vscode-button-background) 50%, var(--vscode-editor-background))"
export const userMessageHoverBackground =
	"color-mix(in srgb, var(--vscode-button-background) 60%, var(--vscode-editor-background))"
export const userMessagePadding = "10px 10px"
export const userMessageMargin = "10px 0px 10px 0px"

// Mcp Sections
export const mcpSectionsPadding = 5

// Error row
export const errorRowFontSize = primaryFontSize - 1
export const errorRowPadding = "10px 8px 10px 2px"
export const errorRowColor = warningColor
export const errorMessageOpacity = 0.8

// Animation transitions durations
export const defaultDuration = 150 // ms
export const rowHideDuration = 500 // ms
export const pulseDuration = "2s"

// Pulsate animation for approval border
export const pulsate = keyframes`
  0% { border-color: var(--vscode-inputOption-activeBorder); }
  100% { border-color: rgba(255, 255, 255, 0); }
`

// Plan/Act Mode background colors
const actModeColor = "var(--vscode-button-background)"
const planModeColor = "var(--vscode-charts-yellow)"
// One high contrast color for both modes
const highContrastModeColor = "var(--vscode-settings-checkboxBorder)"

// Plan/Act Mode text colors
export const actModeTextColor = "var(--vscode-button-foreground)"
export const planModeTextColor = "var(--vscode-editor-background)"
export const inactiveModeTextColor = "var(--vscode-foreground)"

// Reactive theme detection
export function isHighContrastTheme(): boolean {
	return (
		document.body.classList.contains("vscode-high-contrast") ||
		document.body.classList.contains("vscode-high-contrast-light") ||
		window.matchMedia("(forced-colors: active)").matches
	)
}

// Dynamic color getters that re-evaluate on access
export const getActModeColor = (): string => {
	return isHighContrastTheme() ? highContrastModeColor : actModeColor
}

export const getPlanModeColor = (): string => {
	return planModeColor
}

// React hook for theme changes
export function useTheme() {
	const [, forceUpdate] = useState({})

	useEffect(() => {
		const cleanup = onThemeChange(() => {
			forceUpdate({}) // Force re-render on theme change
		})
		return cleanup
	}, [])

	return {
		isHighContrast: isHighContrastTheme(),
		actModeColor: getActModeColor(),
		planModeColor: getPlanModeColor(),
	}
}

// Listen to theme changes
export function onThemeChange(callback: () => void): () => void {
	// Watch for class changes on body (VSCode adds theme classes)
	const bodyObserver = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			if (mutation.attributeName === "class") {
				callback()
			}
		}
	})

	bodyObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] })

	// Watch for forced-colors media query changes
	const mediaQuery = window.matchMedia("(forced-colors: active)")
	const mediaQueryHandler = () => callback()

	// Modern browsers
	if (mediaQuery.addEventListener) {
		mediaQuery.addEventListener("change", mediaQueryHandler)
	} else {
		// Legacy browsers
		mediaQuery.addListener(mediaQueryHandler)
	}

	// Return cleanup function
	return () => {
		bodyObserver.disconnect()
		if (mediaQuery.removeEventListener) {
			mediaQuery.removeEventListener("change", mediaQueryHandler)
		} else {
			mediaQuery.removeListener(mediaQueryHandler)
		}
	}
}
