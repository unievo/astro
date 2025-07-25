import { CHAT_CONSTANTS } from "@/components/chat/chat-view/constants"

const { MAX_IMAGES_AND_FILES_PER_MESSAGE } = CHAT_CONSTANTS
import ContextMenu from "@/components/chat/ContextMenu"
import SlashCommandMenu from "@/components/chat/SlashCommandMenu"
import { CODE_BLOCK_BG_COLOR } from "@/components/common/CodeBlock"
import Thumbnails from "@/components/common/Thumbnails"
import Tooltip from "@/components/common/Tooltip"
import ApiOptions from "@/components/settings/ApiOptions"
import { normalizeApiConfiguration } from "@/components/settings/utils/providerUtils"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { FileServiceClient, StateServiceClient, ModelsServiceClient } from "@/services/grpc-client"
import {
	ContextMenuOptionType,
	getContextMenuOptions,
	getContextMenuOptionIndex,
	insertMention,
	insertMentionDirectly,
	removeMention,
	SearchResult,
	shouldShowContextMenu,
} from "@/utils/context-mentions"
import { useMetaKeyDetection, useShortcut } from "@/utils/hooks"
import {
	getMatchingSlashCommands,
	insertSlashCommand,
	removeSlashCommand,
	shouldShowSlashCommandsMenu,
	SlashCommand,
	slashCommandDeleteRegex,
	validateSlashCommand,
	getWorkflowCommands,
	DEFAULT_SLASH_COMMANDS,
} from "@/utils/slash-commands"
import { validateApiConfiguration, validateModelId } from "@/utils/validate"
import { ChatSettings } from "@shared/ChatSettings"
import { mentionRegex, mentionRegexGlobal } from "@shared/context-mentions"
import { EmptyRequest, StringRequest } from "@shared/proto/common"
import { FileSearchRequest, RelativePathsRequest } from "@shared/proto/file"
import { UpdateApiConfigurationRequest } from "@shared/proto/models"
import { convertApiConfigurationToProto } from "@shared/proto-conversions/models/api-configuration-conversion"
import { PlanActMode, TogglePlanActModeRequest } from "@shared/proto/state"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import React, { forwardRef, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import DynamicTextArea from "react-textarea-autosize"
import { useClickAway, useEvent, useWindowSize } from "react-use"
import styled from "styled-components"
import ClineRulesToggleModal from "../cline-rules/ClineRulesToggleModal"
import ServersToggleModal from "./ServersToggleModal"
import { actModeColor, chatTextAreaBackground, itemIconColor, menuBackground, planModeColor } from "../theme"
import HeroTooltip from "../common/HeroTooltip"
import { ignoreWorkspaceDirectories } from "@shared/Configuration"

const getImageDimensions = (dataUrl: string): Promise<{ width: number; height: number }> => {
	return new Promise((resolve, reject) => {
		const img = new Image()
		img.onload = () => {
			if (img.naturalWidth > 7500 || img.naturalHeight > 7500) {
				reject(new Error("Image dimensions exceed maximum allowed size of 7500px."))
			} else {
				resolve({ width: img.naturalWidth, height: img.naturalHeight })
			}
		}
		img.onerror = (err) => {
			console.error("Failed to load image for dimension check:", err)
			reject(new Error("Failed to load image to check dimensions."))
		}
		img.src = dataUrl
	})
}

// Set to "File" option by default
const DEFAULT_CONTEXT_MENU_OPTION = getContextMenuOptionIndex(ContextMenuOptionType.File)

interface ChatTextAreaProps {
	inputValue: string
	activeQuote: string | null
	setInputValue: (value: string) => void
	sendingDisabled: boolean
	placeholderText: string
	selectedFiles: string[]
	selectedImages: string[]
	setSelectedImages: React.Dispatch<React.SetStateAction<string[]>>
	setSelectedFiles: React.Dispatch<React.SetStateAction<string[]>>
	onSend: () => void
	onSelectFilesAndImages: () => void
	shouldDisableFilesAndImages: boolean
	onHeightChange?: (height: number) => void
	onFocusChange?: (isFocused: boolean) => void
}

interface GitCommit {
	type: ContextMenuOptionType.Git
	value: string
	label: string
	description: string
}

const PLAN_MODE_COLOR = planModeColor
const ACT_MODE_COLOR = actModeColor

const SwitchOption = styled.div<{ isActive: boolean }>`
	padding: 2px 8px;
	color: ${(props) => (props.isActive ? "white" : "var(--vscode-input-foreground)")};
	z-index: 1;
	transition: color 0.2s ease;
	font-size: 12px;
	width: 50%;
	text-align: center;

	&:hover {
		background-color: ${(props) => (!props.isActive ? "var(--vscode-toolbar-hoverBackground)" : "transparent")};
	}
`

const SwitchContainer = styled.div<{ disabled: boolean }>`
	display: flex;
	align-items: center;
	background-color: var(--vscode-editor-background);
	border: 0px solid var(--vscode-charts-lines);
	border-radius: 5px;
	overflow: hidden;
	cursor: ${(props) => (props.disabled ? "not-allowed" : "pointer")};
	opacity: ${(props) => (props.disabled ? 0.5 : 1)};
	transform: scale(0.9);
	transform-origin: right center;
	margin-left: -10px; // compensate for the transform so flex spacing works
	user-select: none; // Prevent text selection
`

const Slider = styled.div<{ isAct: boolean; isPlan?: boolean }>`
	position: absolute;
	height: 100%;
	width: 50%;
	background-color: ${(props) => (props.isPlan ? PLAN_MODE_COLOR : ACT_MODE_COLOR)};
	transition: transform 0.2s ease;
	transform: translateX(${(props) => (props.isAct ? "100%" : "0%")});
`

const ButtonGroup = styled.div`
	display: flex;
	align-items: center;
	gap: 1px;
	flex: 1;
	min-width: 0;
`

const ButtonContainer = styled.div`
	display: flex;
	align-items: center;
	gap: 0px;
	font-size: 10px;
	white-space: nowrap;
	min-width: 0;
	width: 100%;
`

const ControlsContainer = styled.div`
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-top: -5px;
	padding: 0px 5px 5px 10px;
	margin-left: 8px;
	margin-right: 8px;
	overflow: hidden;
`

const ModelSelectorTooltip = styled.div<ModelSelectorTooltipProps>`
	position: fixed;
	bottom: calc(100% + 9px);
	left: 15px;
	right: 15px;
	background: ${menuBackground};
	border: 1px solid var(--vscode-editorGroup-border);
	padding: 12px;
	border-radius: 3px;
	z-index: 1000;
	max-height: calc(100vh - 100px);
	overflow-y: auto;
	overscroll-behavior: contain;

	// Add invisible padding for hover zone
	&::before {
		content: "";
		position: fixed;
		bottom: ${(props) => `calc(100vh - ${props.menuPosition}px - 2px)`};
		left: 0;
		right: 0;
		height: 8px;
	}

	// Arrow pointing down
	&::after {
		content: "";
		position: fixed;
		bottom: ${(props) => `calc(100vh - ${props.menuPosition}px)`};
		right: ${(props) => props.arrowPosition}px;
		width: 10px;
		height: 10px;
		background: ${menuBackground};
		border-right: 1px solid var(--vscode-editorGroup-border);
		border-bottom: 1px solid var(--vscode-editorGroup-border);
		transform: rotate(45deg);
		z-index: -1;
	}
`

const ModelContainer = styled.div`
	position: relative;
	display: flex;
	flex: 1;
	min-width: 0;
	justify-content: flex-end;
`

const ModelButtonWrapper = styled.div`
	display: inline-flex; // Make it shrink to content
	min-width: 0; // Allow shrinking
	max-width: 100%; // Don't overflow parent
`

const ModelDisplayButton = styled.a<{ isActive?: boolean; disabled?: boolean }>`
	padding: 0px 0px;
	height: 20px;
	width: 100%;
	min-width: 0;
	cursor: ${(props) => (props.disabled ? "not-allowed" : "pointer")};
	text-decoration: ${(props) => (props.isActive ? "underline" : "none")};
	color: ${(props) => (props.isActive ? "var(--vscode-foreground)" : "var(--vscode-descriptionForeground)")};
	display: flex;
	align-items: center;
	font-size: 10px;
	outline: none;
	user-select: none;
	opacity: ${(props) => (props.disabled ? 0.5 : 1)};
	pointer-events: ${(props) => (props.disabled ? "none" : "auto")};

	&:hover,
	&:focus {
		color: ${(props) => (props.disabled ? "var(--vscode-descriptionForeground)" : "var(--vscode-foreground)")};
		text-decoration: ${(props) => (props.disabled ? "none" : "underline")};
		outline: none;
	}

	&:active {
		color: ${(props) => (props.disabled ? "var(--vscode-descriptionForeground)" : "var(--vscode-foreground)")};
		text-decoration: ${(props) => (props.disabled ? "none" : "underline")};
		outline: none;
	}

	&:focus-visible {
		outline: none;
	}
`

const ModelButtonContent = styled.div`
	width: 100%;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	direction: rtl;
	text-align: left;
`

const ChatTextArea = forwardRef<HTMLTextAreaElement, ChatTextAreaProps>(
	(
		{
			inputValue,
			activeQuote,
			setInputValue,
			sendingDisabled,
			placeholderText,
			selectedFiles,
			selectedImages,
			setSelectedImages,
			setSelectedFiles,
			onSend,
			onSelectFilesAndImages,
			shouldDisableFilesAndImages,
			onHeightChange,
			onFocusChange,
		},
		ref,
	) => {
		const {
			filePaths,
			chatSettings,
			apiConfiguration,
			openRouterModels,
			platform,
			localWorkflowToggles,
			globalWorkflowToggles,
		} = useExtensionState()
		const [isTextAreaFocused, setIsTextAreaFocused] = useState(false)
		const [isDraggingOver, setIsDraggingOver] = useState(false)
		const [gitCommits, setGitCommits] = useState<GitCommit[]>([])

		const [showSlashCommandsMenu, setShowSlashCommandsMenu] = useState(false)
		const [selectedSlashCommandsIndex, setSelectedSlashCommandsIndex] = useState(0)
		const [slashCommandsQuery, setSlashCommandsQuery] = useState("")
		const slashCommandsMenuContainerRef = useRef<HTMLDivElement>(null)

		const [thumbnailsHeight, setThumbnailsHeight] = useState(0)
		const [textAreaBaseHeight, setTextAreaBaseHeight] = useState<number | undefined>(undefined)
		const [showContextMenu, setShowContextMenu] = useState(false)
		const [cursorPosition, setCursorPosition] = useState(0)
		const [searchQuery, setSearchQuery] = useState("")
		const textAreaRef = useRef<HTMLTextAreaElement | null>(null)
		const [isMouseDownOnMenu, setIsMouseDownOnMenu] = useState(false)
		const highlightLayerRef = useRef<HTMLDivElement>(null)
		const [selectedMenuIndex, setSelectedMenuIndex] = useState(-1)
		const [selectedType, setSelectedType] = useState<ContextMenuOptionType | null>(null)
		const [justDeletedSpaceAfterMention, setJustDeletedSpaceAfterMention] = useState(false)
		const [justDeletedSpaceAfterSlashCommand, setJustDeletedSpaceAfterSlashCommand] = useState(false)
		const [intendedCursorPosition, setIntendedCursorPosition] = useState<number | null>(null)
		const contextMenuContainerRef = useRef<HTMLDivElement>(null)
		const [showModelSelector, setShowModelSelector] = useState(false)
		const modelSelectorRef = useRef<HTMLDivElement>(null)
		const { width: viewportWidth, height: viewportHeight } = useWindowSize()
		const buttonRef = useRef<HTMLDivElement>(null)
		const [arrowPosition, setArrowPosition] = useState(0)
		const [menuPosition, setMenuPosition] = useState(0)
		const [shownTooltipMode, setShownTooltipMode] = useState<ChatSettings["mode"] | null>(null)
		const [pendingInsertions, setPendingInsertions] = useState<string[]>([])
		const shiftHoldTimerRef = useRef<NodeJS.Timeout | null>(null)
		const [showUnsupportedFileError, setShowUnsupportedFileError] = useState(false)
		const unsupportedFileTimerRef = useRef<NodeJS.Timeout | null>(null)
		const [showDimensionError, setShowDimensionError] = useState(false)
		const dimensionErrorTimerRef = useRef<NodeJS.Timeout | null>(null)

		const [fileSearchResults, setFileSearchResults] = useState<SearchResult[]>([])
		const [searchLoading, setSearchLoading] = useState(false)
		const [, metaKeyChar] = useMetaKeyDetection(platform)

		// Add a ref to track previous menu state
		const prevShowModelSelector = useRef(showModelSelector)

		// Fetch git commits when Git is selected or when typing a hash
		useEffect(() => {
			if (selectedType === ContextMenuOptionType.Git || /^[a-f0-9]+$/i.test(searchQuery)) {
				FileServiceClient.searchCommits(StringRequest.create({ value: searchQuery || "" }))
					.then((response) => {
						if (response.commits) {
							const commits: GitCommit[] = response.commits.map(
								(commit: { hash: string; shortHash: string; subject: string; author: string; date: string }) => ({
									type: ContextMenuOptionType.Git,
									value: commit.hash,
									label: commit.subject,
									description: `${commit.shortHash} by ${commit.author} on ${commit.date}`,
								}),
							)
							setGitCommits(commits)
						}
					})
					.catch((error) => {
						console.error("Error searching commits:", error)
					})
			}
		}, [selectedType, searchQuery])

		// Function to filter out excluded directories
		const filterExcludedDirectories = useCallback(
			(filePaths: string[]) => {
				const excludePatterns = ignoreWorkspaceDirectories.map((pattern: string) => pattern.trim())

				return filePaths.filter((filePath) => {
					// Normalize the file path by removing leading slash
					const normalizedPath = filePath.startsWith("/") ? filePath.slice(1) : filePath

					// Check if any exclude pattern matches the path
					return !excludePatterns.some((pattern: string) => {
						// Handle different types of path matching
						if (pattern.includes("/")) {
							// Pattern contains slash, match as exact path prefix
							return normalizedPath.startsWith(pattern + "/") || normalizedPath === pattern
						} else {
							// Pattern is a directory name, check if it appears as a complete directory component
							const pathSegments = normalizedPath.split("/")
							return pathSegments.includes(pattern)
						}
					})
				})
			},
			[ignoreWorkspaceDirectories],
		)

		const queryItems = useMemo(() => {
			const filteredFilePaths = filterExcludedDirectories(filePaths)

			let items = [
				{ type: ContextMenuOptionType.Problems, value: "problems" },
				{ type: ContextMenuOptionType.Terminal, value: "terminal" },
				...gitCommits,
				...filteredFilePaths
					.map((file) => "/" + file)
					.map((path) => ({
						type: path.endsWith("/") ? ContextMenuOptionType.Folder : ContextMenuOptionType.File,
						value: path,
					})),
			]

			// Filter by selected type if one is set
			if (selectedType) {
				items = items.filter((item) => item.type === selectedType)
			}

			return items
		}, [filePaths, gitCommits, filterExcludedDirectories, selectedType])

		useEffect(() => {
			const handleClickOutside = (event: MouseEvent) => {
				if (contextMenuContainerRef.current && !contextMenuContainerRef.current.contains(event.target as Node)) {
					setShowContextMenu(false)
				}
			}

			if (showContextMenu) {
				document.addEventListener("mousedown", handleClickOutside)
			}

			return () => {
				document.removeEventListener("mousedown", handleClickOutside)
			}
		}, [showContextMenu, setShowContextMenu])

		useEffect(() => {
			const handleClickOutsideSlashMenu = (event: MouseEvent) => {
				if (
					slashCommandsMenuContainerRef.current &&
					!slashCommandsMenuContainerRef.current.contains(event.target as Node)
				) {
					setShowSlashCommandsMenu(false)
				}
			}

			if (showSlashCommandsMenu) {
				document.addEventListener("mousedown", handleClickOutsideSlashMenu)
			}

			return () => {
				document.removeEventListener("mousedown", handleClickOutsideSlashMenu)
			}
		}, [showSlashCommandsMenu])

		// Global Esc key handler for model selector
		useEffect(() => {
			const handleGlobalKeyDown = (event: KeyboardEvent) => {
				if (event.key === "Escape" && showModelSelector) {
					event.preventDefault()
					event.stopPropagation()
					setShowModelSelector(false)
					// Focus the textarea after closing the modal
					setTimeout(() => {
						textAreaRef.current?.focus()
					}, 0)
				}
			}

			if (showModelSelector) {
				document.addEventListener("keydown", handleGlobalKeyDown)
			}

			return () => {
				document.removeEventListener("keydown", handleGlobalKeyDown)
			}
		}, [showModelSelector])

		const handleMentionSelect = useCallback(
			(type: ContextMenuOptionType, value?: string) => {
				if (type === ContextMenuOptionType.NoResults) {
					return
				}

				if (
					type === ContextMenuOptionType.File ||
					type === ContextMenuOptionType.Folder ||
					type === ContextMenuOptionType.Git
				) {
					if (!value) {
						setSelectedType(type)
						setSearchQuery("")
						setSelectedMenuIndex(0)
						return
					}
				}

				setShowContextMenu(false)
				setSelectedType(null)
				if (textAreaRef.current) {
					let insertValue = value || ""
					if (type === ContextMenuOptionType.URL) {
						insertValue = value || ""
					} else if (type === ContextMenuOptionType.File || type === ContextMenuOptionType.Folder) {
						insertValue = value || ""
					} else if (type === ContextMenuOptionType.Problems) {
						insertValue = "problems"
					} else if (type === ContextMenuOptionType.Terminal) {
						insertValue = "terminal"
					} else if (type === ContextMenuOptionType.Git) {
						insertValue = value || ""
					}

					const { newValue, mentionIndex } = insertMention(textAreaRef.current.value, cursorPosition, insertValue)

					setInputValue(newValue)
					const newCursorPosition = newValue.indexOf(" ", mentionIndex + insertValue.length) + 1
					setCursorPosition(newCursorPosition)
					setIntendedCursorPosition(newCursorPosition)
					// textAreaRef.current.focus()

					// scroll to cursor
					setTimeout(() => {
						if (textAreaRef.current) {
							textAreaRef.current.blur()
							textAreaRef.current.focus()
						}
					}, 0)
				}
			},
			[setInputValue, cursorPosition],
		)

		const handleSlashCommandsSelect = useCallback(
			(command: SlashCommand) => {
				setShowSlashCommandsMenu(false)

				if (textAreaRef.current) {
					const { newValue, commandIndex } = insertSlashCommand(textAreaRef.current.value, command.name)
					const newCursorPosition = newValue.indexOf(" ", commandIndex + 1 + command.name.length) + 1

					setInputValue(newValue)
					setCursorPosition(newCursorPosition)
					setIntendedCursorPosition(newCursorPosition)

					setTimeout(() => {
						if (textAreaRef.current) {
							textAreaRef.current.blur()
							textAreaRef.current.focus()
						}
					}, 0)
				}
			},
			[setInputValue],
		)

		const handleKeyDown = useCallback(
			(event: React.KeyboardEvent<HTMLTextAreaElement>) => {
				if (showSlashCommandsMenu) {
					if (event.key === "Escape") {
						setShowSlashCommandsMenu(false)
						return
					}

					if (event.key === "ArrowUp" || event.key === "ArrowDown") {
						event.preventDefault()
						setSelectedSlashCommandsIndex((prevIndex) => {
							const direction = event.key === "ArrowUp" ? -1 : 1
							// Get commands with workflow toggles
							const allCommands = getMatchingSlashCommands(
								slashCommandsQuery,
								localWorkflowToggles,
								globalWorkflowToggles,
							)

							if (allCommands.length === 0) {
								return prevIndex
							}

							// Calculate total command count
							const totalCommandCount = allCommands.length

							// Create wraparound navigation - moves from last item to first and vice versa
							const newIndex = (prevIndex + direction + totalCommandCount) % totalCommandCount
							return newIndex
						})
						return
					}

					if ((event.key === "Enter" || event.key === "Tab") && selectedSlashCommandsIndex !== -1) {
						event.preventDefault()
						const commands = getMatchingSlashCommands(slashCommandsQuery, localWorkflowToggles, globalWorkflowToggles)
						if (commands.length > 0) {
							handleSlashCommandsSelect(commands[selectedSlashCommandsIndex])
						}
						return
					}
				}
				if (showContextMenu) {
					if (event.key === "Escape") {
						// event.preventDefault()
						setSelectedType(null)
						setSelectedMenuIndex(DEFAULT_CONTEXT_MENU_OPTION)
						return
					}

					if (event.key === "ArrowUp" || event.key === "ArrowDown") {
						event.preventDefault()
						setSelectedMenuIndex((prevIndex) => {
							const direction = event.key === "ArrowUp" ? -1 : 1
							const options = getContextMenuOptions(searchQuery, selectedType, queryItems, fileSearchResults)
							const optionsLength = options.length

							if (optionsLength === 0) return prevIndex

							// Find selectable options (non-URL types)
							const selectableOptions = options.filter(
								(option) =>
									option.type !== ContextMenuOptionType.URL && option.type !== ContextMenuOptionType.NoResults,
							)

							if (selectableOptions.length === 0) return -1 // No selectable options

							// Find the index of the next selectable option
							const currentSelectableIndex = selectableOptions.findIndex((option) => option === options[prevIndex])

							const newSelectableIndex =
								(currentSelectableIndex + direction + selectableOptions.length) % selectableOptions.length

							// Find the index of the selected option in the original options array
							return options.findIndex((option) => option === selectableOptions[newSelectableIndex])
						})
						return
					}
					if ((event.key === "Enter" || event.key === "Tab") && selectedMenuIndex !== -1) {
						event.preventDefault()
						const selectedOption = getContextMenuOptions(searchQuery, selectedType, queryItems, fileSearchResults)[
							selectedMenuIndex
						]
						if (
							selectedOption &&
							selectedOption.type !== ContextMenuOptionType.URL &&
							selectedOption.type !== ContextMenuOptionType.NoResults
						) {
							handleMentionSelect(selectedOption.type, selectedOption.value)
						}
						return
					}
				}

				const isComposing = event.nativeEvent?.isComposing ?? false
				if (event.key === "Enter" && !event.shiftKey && !isComposing) {
					event.preventDefault()

					if (!sendingDisabled) {
						setIsTextAreaFocused(false)
						onSend()
					}
				}

				if (event.key === "Backspace" && !isComposing) {
					const charBeforeCursor = inputValue[cursorPosition - 1]
					const charAfterCursor = inputValue[cursorPosition + 1]

					const charBeforeIsWhitespace =
						charBeforeCursor === " " || charBeforeCursor === "\n" || charBeforeCursor === "\r\n"
					const charAfterIsWhitespace =
						charAfterCursor === " " || charAfterCursor === "\n" || charAfterCursor === "\r\n"

					// Check if we're at @ with a selected type (after filtering files/folders)
					if (charBeforeCursor === "@" && selectedType) {
						// Reset to main menu instead of deleting @
						event.preventDefault()
						setSelectedType(null)
						setSearchQuery("")
						setSelectedMenuIndex(DEFAULT_CONTEXT_MENU_OPTION)
						return
					}

					// Check if we're right after a space that follows a mention or slash command
					if (
						charBeforeIsWhitespace &&
						inputValue.slice(0, cursorPosition - 1).match(new RegExp(mentionRegex.source + "$"))
					) {
						// File mention handling
						const newCursorPosition = cursorPosition - 1
						if (!charAfterIsWhitespace) {
							event.preventDefault()
							textAreaRef.current?.setSelectionRange(newCursorPosition, newCursorPosition)
							setCursorPosition(newCursorPosition)
						}
						setCursorPosition(newCursorPosition)
						setJustDeletedSpaceAfterMention(true)
						setJustDeletedSpaceAfterSlashCommand(false)
					} else if (charBeforeIsWhitespace && inputValue.slice(0, cursorPosition - 1).match(slashCommandDeleteRegex)) {
						// Check if this is the space immediately after a complete slash command
						const textBeforeCursor = inputValue.slice(0, cursorPosition - 1)
						const slashIndex = textBeforeCursor.lastIndexOf("/")

						if (slashIndex !== -1) {
							const commandText = textBeforeCursor.slice(slashIndex + 1)

							// Get all available commands
							const workflowCommands = getWorkflowCommands(localWorkflowToggles, globalWorkflowToggles)
							const allCommands = [...DEFAULT_SLASH_COMMANDS, ...workflowCommands]

							// Check if this is exactly a complete command (no extra text after)
							const isExactCompleteCommand = allCommands.some(
								(cmd) => cmd.name.toLowerCase() === commandText.toLowerCase(),
							)

							// Only trigger slash command deletion if:
							// 1. It's an exact complete command, AND
							// 2. There's no more text after the cursor (or only whitespace)
							const textAfterCursor = inputValue.slice(cursorPosition)
							const hasOnlyWhitespaceAfter = /^\s*$/.test(textAfterCursor)

							if (isExactCompleteCommand && hasOnlyWhitespaceAfter) {
								// This is the space immediately after a complete command with no additional text
								const newCursorPosition = cursorPosition - 1
								if (!charAfterIsWhitespace) {
									event.preventDefault()
									textAreaRef.current?.setSelectionRange(newCursorPosition, newCursorPosition)
									setCursorPosition(newCursorPosition)
								}
								setCursorPosition(newCursorPosition)
								setJustDeletedSpaceAfterSlashCommand(true)
								setJustDeletedSpaceAfterMention(false)
							} else {
								// This is a space within additional text after a command, handle normally
								setJustDeletedSpaceAfterMention(false)
								setJustDeletedSpaceAfterSlashCommand(false)
							}
						}
					}
					// Handle the second backspace press for mentions or slash commands
					else if (justDeletedSpaceAfterMention) {
						const { newText, newPosition } = removeMention(inputValue, cursorPosition)
						if (newText !== inputValue) {
							event.preventDefault()
							setInputValue(newText)
							setIntendedCursorPosition(newPosition)
						}
						setJustDeletedSpaceAfterMention(false)
						setShowContextMenu(false)
					} else if (justDeletedSpaceAfterSlashCommand) {
						// New slash command deletion
						const { newText, newPosition } = removeSlashCommand(inputValue, cursorPosition)
						if (newText !== inputValue) {
							event.preventDefault()
							setInputValue(newText)
							setIntendedCursorPosition(newPosition)
						}
						setJustDeletedSpaceAfterSlashCommand(false)
						setShowSlashCommandsMenu(false)
					}
					// Default case - reset flags if none of the above apply
					else {
						setJustDeletedSpaceAfterMention(false)
						setJustDeletedSpaceAfterSlashCommand(false)
					}
				}
			},
			[
				onSend,
				showContextMenu,
				searchQuery,
				selectedMenuIndex,
				handleMentionSelect,
				selectedType,
				inputValue,
				cursorPosition,
				setInputValue,
				justDeletedSpaceAfterMention,
				queryItems,
				fileSearchResults,
				showSlashCommandsMenu,
				selectedSlashCommandsIndex,
				slashCommandsQuery,
				handleSlashCommandsSelect,
				sendingDisabled,
			],
		)

		// Effect to set cursor position after state updates
		useLayoutEffect(() => {
			if (intendedCursorPosition !== null && textAreaRef.current) {
				textAreaRef.current.setSelectionRange(intendedCursorPosition, intendedCursorPosition)
				setIntendedCursorPosition(null) // Reset the state after applying
			}
		}, [inputValue, intendedCursorPosition])

		useEffect(() => {
			if (pendingInsertions.length === 0 || !textAreaRef.current) {
				return
			}

			const path = pendingInsertions[0]
			const currentTextArea = textAreaRef.current
			const currentValue = currentTextArea.value
			const currentCursorPos =
				intendedCursorPosition ??
				(currentTextArea.selectionStart >= 0 ? currentTextArea.selectionStart : currentValue.length)

			const { newValue, mentionIndex } = insertMentionDirectly(currentValue, currentCursorPos, path)

			setInputValue(newValue)

			const newCursorPosition = mentionIndex + path.length + 2
			setIntendedCursorPosition(newCursorPosition)

			setPendingInsertions((prev) => prev.slice(1))
		}, [pendingInsertions, setInputValue])

		const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

		const currentSearchQueryRef = useRef<string>("")

		const handleInputChange = useCallback(
			(e: React.ChangeEvent<HTMLTextAreaElement>) => {
				const newValue = e.target.value
				const newCursorPosition = e.target.selectionStart
				setInputValue(newValue)
				setCursorPosition(newCursorPosition)
				let showMenu = shouldShowContextMenu(newValue, newCursorPosition)
				const showSlashCommandsMenu = shouldShowSlashCommandsMenu(
					newValue,
					newCursorPosition,
					localWorkflowToggles,
					globalWorkflowToggles,
				)

				// we do not allow both menus to be shown at the same time
				// the slash commands menu has precedence bc its a narrower component
				if (showSlashCommandsMenu) {
					showMenu = false
				}

				setShowSlashCommandsMenu(showSlashCommandsMenu)
				setShowContextMenu(showMenu)

				if (showSlashCommandsMenu) {
					const slashIndex = newValue.indexOf("/")
					const query = newValue.slice(slashIndex + 1, newCursorPosition)
					setSlashCommandsQuery(query)
					setSelectedSlashCommandsIndex(0)
				} else {
					setSlashCommandsQuery("")
					setSelectedSlashCommandsIndex(0)
				}

				if (showMenu) {
					const lastAtIndex = newValue.lastIndexOf("@", newCursorPosition - 1)
					const query = newValue.slice(lastAtIndex + 1, newCursorPosition)
					setSearchQuery(query)
					currentSearchQueryRef.current = query

					if (query.length > 0 && !selectedType) {
						setSelectedMenuIndex(0)

						// Clear any existing timeout
						if (searchTimeoutRef.current) {
							clearTimeout(searchTimeoutRef.current)
						}

						setSearchLoading(true)

						// Set a timeout to debounce the search requests
						searchTimeoutRef.current = setTimeout(() => {
							FileServiceClient.searchFiles(
								FileSearchRequest.create({
									query: query,
									mentionsRequestId: query,
								}),
							)
								.then((results) => {
									// Filter search results through the same exclusion logic
									const filteredResults = (results.results || []).filter((result: SearchResult) => {
										// Create a mock file path array to use our existing filter
										const mockFilePaths = [result.path || ""]
										const filtered = filterExcludedDirectories(mockFilePaths)
										return filtered.length > 0
									})

									setFileSearchResults([])
									setFileSearchResults(filteredResults)
									setSearchLoading(false)
								})
								.catch((error) => {
									console.error("Error searching files:", error)
									setFileSearchResults([])
									setSearchLoading(false)
								})
						}, 200) // 200ms debounce
					} else if (query.length > 0 && selectedType) {
						// When filtering within a selected type, always highlight the first item
						setSelectedMenuIndex(0)
					} else {
						setSelectedMenuIndex(DEFAULT_CONTEXT_MENU_OPTION)
					}
				} else {
					setSearchQuery("")
					setSelectedMenuIndex(-1)
					setFileSearchResults([])
					setSelectedType(null) // Reset selected type when menu is hidden
				}
			},
			[setInputValue, setFileSearchResults, selectedType],
		)

		useEffect(() => {
			if (!showContextMenu) {
				setSelectedType(null)
			}
		}, [showContextMenu])

		const handleBlur = useCallback(() => {
			// Only hide the context menu if the user didn't click on it
			if (!isMouseDownOnMenu) {
				setShowContextMenu(false)
				setShowSlashCommandsMenu(false)
			}
			setIsTextAreaFocused(false)
			onFocusChange?.(false) // Call prop on blur
		}, [isMouseDownOnMenu, onFocusChange])

		const showDimensionErrorMessage = useCallback(() => {
			setShowDimensionError(true)
			if (dimensionErrorTimerRef.current) {
				clearTimeout(dimensionErrorTimerRef.current)
			}
			dimensionErrorTimerRef.current = setTimeout(() => {
				setShowDimensionError(false)
				dimensionErrorTimerRef.current = null
			}, 3000)
		}, [])

		const handlePaste = useCallback(
			async (e: React.ClipboardEvent) => {
				const items = e.clipboardData.items

				const pastedText = e.clipboardData.getData("text")
				// Check if the pasted content is a URL, add space after so user can easily delete if they don't want it
				const urlRegex = /^\S+:\/\/\S+$/
				if (urlRegex.test(pastedText.trim())) {
					e.preventDefault()
					const trimmedUrl = pastedText.trim()
					const newValue = inputValue.slice(0, cursorPosition) + trimmedUrl + " " + inputValue.slice(cursorPosition)
					setInputValue(newValue)
					const newCursorPosition = cursorPosition + trimmedUrl.length + 1
					setCursorPosition(newCursorPosition)
					setIntendedCursorPosition(newCursorPosition)
					setShowContextMenu(false)

					// Scroll to new cursor position
					// https://stackoverflow.com/questions/29899364/how-do-you-scroll-to-the-position-of-the-cursor-in-a-textarea/40951875#40951875
					setTimeout(() => {
						if (textAreaRef.current) {
							textAreaRef.current.blur()
							textAreaRef.current.focus()
						}
					}, 0)
					// NOTE: callbacks dont utilize return function to cleanup, but it's fine since this timeout immediately executes and will be cleaned up by the browser (no chance component unmounts before it executes)

					return
				}

				const acceptedTypes = ["png", "jpeg", "webp"] // supported by anthropic and openrouter (jpg is just a file extension but the image will be recognized as jpeg)
				const imageItems = Array.from(items).filter((item) => {
					const [type, subtype] = item.type.split("/")
					return type === "image" && acceptedTypes.includes(subtype)
				})
				if (!shouldDisableFilesAndImages && imageItems.length > 0) {
					e.preventDefault()
					const imagePromises = imageItems.map((item) => {
						return new Promise<string | null>((resolve) => {
							const blob = item.getAsFile()
							if (!blob) {
								resolve(null)
								return
							}
							const reader = new FileReader()
							reader.onloadend = async () => {
								if (reader.error) {
									console.error("Error reading file:", reader.error)
									resolve(null)
								} else {
									const result = reader.result
									if (typeof result === "string") {
										try {
											await getImageDimensions(result)
											resolve(result)
										} catch (error) {
											console.warn((error as Error).message)
											showDimensionErrorMessage()
											resolve(null)
										}
									} else {
										resolve(null)
									}
								}
							}
							reader.readAsDataURL(blob)
						})
					})
					const imageDataArray = await Promise.all(imagePromises)
					const dataUrls = imageDataArray.filter((dataUrl): dataUrl is string => dataUrl !== null)
					//.map((dataUrl) => dataUrl.split(",")[1]) // strip the mime type prefix, sharp doesn't need it
					if (dataUrls.length > 0) {
						const filesAndImagesLength = selectedImages.length + selectedFiles.length
						const availableSlots = MAX_IMAGES_AND_FILES_PER_MESSAGE - filesAndImagesLength

						if (availableSlots > 0) {
							const imagesToAdd = Math.min(dataUrls.length, availableSlots)
							setSelectedImages((prevImages) => [...prevImages, ...dataUrls.slice(0, imagesToAdd)])
						}
					} else {
						console.warn("No valid images were processed")
					}
				}
			},
			[
				shouldDisableFilesAndImages,
				setSelectedImages,
				selectedImages,
				selectedFiles,
				cursorPosition,
				setInputValue,
				inputValue,
				showDimensionErrorMessage,
			],
		)

		const handleThumbnailsHeightChange = useCallback((height: number) => {
			setThumbnailsHeight(height)
		}, [])

		useEffect(() => {
			if (selectedImages.length === 0 && selectedFiles.length === 0) {
				setThumbnailsHeight(0)
			}
		}, [selectedImages, selectedFiles])

		const handleMenuMouseDown = useCallback(() => {
			setIsMouseDownOnMenu(true)
		}, [])

		const updateHighlights = useCallback(() => {
			if (!textAreaRef.current || !highlightLayerRef.current) return

			let processedText = textAreaRef.current.value

			processedText = processedText
				.replace(/\n$/, "\n\n")
				.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] || c)
				// highlight @mentions
				.replace(mentionRegexGlobal, '<mark class="mention-context-textarea-highlight">$&</mark>')

			// check for highlighting /slash-commands
			if (/^\s*\//.test(processedText)) {
				const slashIndex = processedText.indexOf("/")
				const textAfterSlash = processedText.substring(slashIndex + 1)

				// Get all available commands for matching
				const workflowCommands = getWorkflowCommands(localWorkflowToggles, globalWorkflowToggles)
				const allCommands = [...DEFAULT_SLASH_COMMANDS, ...workflowCommands]

				// Find the longest matching valid command that is complete
				let longestMatch = ""
				let longestMatchLength = 0

				for (const command of allCommands) {
					const commandName = command.name.toLowerCase()
					const textToMatch = textAfterSlash.toLowerCase()

					// Check if the command matches exactly at the start of the text
					if (textToMatch.startsWith(commandName)) {
						// Ensure the match is followed by a space or end of text (complete command)
						const nextChar = textAfterSlash[commandName.length]
						if (!nextChar || nextChar === " ") {
							if (commandName.length > longestMatchLength) {
								longestMatch = command.name
								longestMatchLength = commandName.length
							}
						}
					}
				}

				// If we found a complete valid command match, highlight only that command
				if (longestMatch) {
					const endIndex = slashIndex + 1 + longestMatchLength
					const fullCommand = processedText.substring(slashIndex, endIndex) // includes slash

					const highlighted = `<mark class="mention-context-textarea-highlight">${fullCommand}</mark>`
					processedText = processedText.substring(0, slashIndex) + highlighted + processedText.substring(endIndex)
				}
			}

			highlightLayerRef.current.innerHTML = processedText
			highlightLayerRef.current.scrollTop = textAreaRef.current.scrollTop
			highlightLayerRef.current.scrollLeft = textAreaRef.current.scrollLeft
		}, [localWorkflowToggles, globalWorkflowToggles])

		useLayoutEffect(() => {
			updateHighlights()
		}, [inputValue, updateHighlights])

		const updateCursorPosition = useCallback(() => {
			if (textAreaRef.current) {
				setCursorPosition(textAreaRef.current.selectionStart)
			}
		}, [])

		const handleKeyUp = useCallback(
			(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
				if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) {
					updateCursorPosition()
				}
			},
			[updateCursorPosition],
		)

		// Separate the API config submission logic
		const submitApiConfig = useCallback(async () => {
			const apiValidationResult = validateApiConfiguration(apiConfiguration)
			const modelIdValidationResult = validateModelId(apiConfiguration, openRouterModels)

			if (!apiValidationResult && !modelIdValidationResult && apiConfiguration) {
				try {
					await ModelsServiceClient.updateApiConfigurationProto(
						UpdateApiConfigurationRequest.create({
							apiConfiguration: convertApiConfigurationToProto(apiConfiguration),
						}),
					)
				} catch (error) {
					console.error("Failed to update API configuration:", error)
				}
			} else {
				StateServiceClient.getLatestState(EmptyRequest.create())
					.then(() => {
						console.log("State refreshed")
					})
					.catch((error) => {
						console.error("Error refreshing state:", error)
					})
			}
		}, [apiConfiguration, openRouterModels])

		const onModeToggle = useCallback(() => {
			// if (textAreaDisabled) return
			let changeModeDelay = 0
			if (showModelSelector) {
				// user has model selector open, so we should save it before switching modes
				submitApiConfig()
				changeModeDelay = 250 // necessary to let the api config update (we send message and wait for it to be saved) FIXME: this is a hack and we ideally should check for api config changes, then wait for it to be saved, before switching modes
			}
			setTimeout(async () => {
				const newMode = chatSettings.mode === "plan" ? PlanActMode.ACT : PlanActMode.PLAN
				const response = await StateServiceClient.togglePlanActMode(
					TogglePlanActModeRequest.create({
						chatSettings: {
							mode: newMode,
							preferredLanguage: chatSettings.preferredLanguage,
							openAiReasoningEffort: chatSettings.openAIReasoningEffort,
						},
						chatContent: {
							message: inputValue.trim() ? inputValue : undefined,
							images: selectedImages.length > 0 ? selectedImages : undefined,
							files: selectedFiles.length > 0 ? selectedFiles : undefined,
						},
					}),
				)
				// Focus the textarea after mode toggle with slight delay
				setTimeout(() => {
					if (response.value) {
						setInputValue("")
					}
					textAreaRef.current?.focus()
				}, 100)
			}, changeModeDelay)
		}, [chatSettings.mode, showModelSelector, submitApiConfig, inputValue, selectedImages, selectedFiles])

		useShortcut("Meta+Shift+a", onModeToggle, { disableTextInputs: false }) // important that we don't disable the text input here

		const handleContextButtonClick = useCallback(() => {
			// Focus the textarea first
			textAreaRef.current?.focus()

			// If input is empty, just insert @
			if (!inputValue.trim()) {
				const event = {
					target: {
						value: "@",
						selectionStart: 1,
					},
				} as React.ChangeEvent<HTMLTextAreaElement>
				handleInputChange(event)
				updateHighlights()
				return
			}

			// If input ends with space or is empty, just append @
			if (inputValue.endsWith(" ")) {
				const event = {
					target: {
						value: inputValue + "@",
						selectionStart: inputValue.length + 1,
					},
				} as React.ChangeEvent<HTMLTextAreaElement>
				handleInputChange(event)
				updateHighlights()
				return
			}

			// Otherwise add space then @
			const event = {
				target: {
					value: inputValue + " @",
					selectionStart: inputValue.length + 2,
				},
			} as React.ChangeEvent<HTMLTextAreaElement>
			handleInputChange(event)
			updateHighlights()
		}, [inputValue, handleInputChange, updateHighlights])

		const handleCommandButtonClick = useCallback(() => {
			// Focus the textarea first
			textAreaRef.current?.focus()

			// Clear input and insert /
			setInputValue("/")
			const event = {
				target: {
					value: "/",
					selectionStart: 1,
				},
			} as React.ChangeEvent<HTMLTextAreaElement>
			handleInputChange(event)
			updateHighlights()
			return
		}, [inputValue, handleInputChange, updateHighlights])

		// Use an effect to detect menu close
		useEffect(() => {
			if (prevShowModelSelector.current && !showModelSelector) {
				// Menu was just closed
				submitApiConfig()
			}
			prevShowModelSelector.current = showModelSelector
		}, [showModelSelector, submitApiConfig])

		// Remove the handleApiConfigSubmit callback
		// Update click handler to just toggle the menu
		const handleModelButtonClick = () => {
			setShowModelSelector(!showModelSelector)
		}

		// Update click away handler to just close menu
		useClickAway(modelSelectorRef, () => {
			setShowModelSelector(false)
		})

		// Get model display name
		const modelDisplayName = useMemo(() => {
			const { selectedProvider, selectedModelId } = normalizeApiConfiguration(apiConfiguration)
			const unknownModel = "unknown"
			if (!apiConfiguration) return unknownModel
			switch (selectedProvider) {
				case "cline":
					// return `${selectedProvider}:${selectedModelId}`
					return `${selectedModelId}`
				case "openai":
					// return `openai(c):${selectedModelId}`
					return `${selectedModelId}`
				case "vscode-lm":
					// return `${apiConfiguration.vsCodeLmModelSelector ? `${apiConfiguration.vsCodeLmModelSelector.vendor ?? ""}/${apiConfiguration.vsCodeLmModelSelector.family ?? ""}` : unknownModel}`
					return `${apiConfiguration.vsCodeLmModelSelector ? `${apiConfiguration.vsCodeLmModelSelector.family ?? ""}` : unknownModel}`
				case "together":
					// return `${selectedProvider}:${apiConfiguration.togetherModelId}`
					return `${apiConfiguration.togetherModelId}`
				case "fireworks":
					// return `fireworks:${apiConfiguration.fireworksModelId}`
					return `${apiConfiguration.fireworksModelId}`
				case "lmstudio":
					// return `${selectedProvider}:${apiConfiguration.lmStudioModelId}`
					return `${apiConfiguration.lmStudioModelId}`
				case "ollama":
					// return `${selectedProvider}:${apiConfiguration.ollamaModelId}`
					return `${apiConfiguration.ollamaModelId}`
				case "litellm":
					// return `${selectedProvider}:${apiConfiguration.liteLlmModelId}`
					return `${apiConfiguration.liteLlmModelId}`
				case "requesty":
					// return `${selectedProvider}:${apiConfiguration.requestyModelId}`
					return `${apiConfiguration.requestyModelId}`
				case "anthropic":
				case "openrouter":
				default:
					// return `${selectedProvider}:${selectedModelId}`
					return `${selectedModelId}`
			}
		}, [apiConfiguration])

		// Calculate arrow position and menu position based on button location
		useEffect(() => {
			if (showModelSelector && buttonRef.current) {
				const buttonRect = buttonRef.current.getBoundingClientRect()
				const buttonCenter = buttonRect.left + buttonRect.width / 2

				// Calculate distance from right edge of viewport using viewport coordinates
				const rightPosition = document.documentElement.clientWidth - buttonCenter - 5

				setArrowPosition(rightPosition)
				setMenuPosition(buttonRect.top + 1) // Added +1 to move menu down by 1px
			}
		}, [showModelSelector, viewportWidth, viewportHeight])

		useEffect(() => {
			if (!showModelSelector) {
				// Attempt to save if possible
				// NOTE: we cannot call this here since it will create an infinite loop between this effect and the callback since getLatestState will update state. Instead we should submitapiconfig when the menu is explicitly closed, rather than as an effect of showModelSelector changing.
				// handleApiConfigSubmit()

				// Reset any active styling by blurring the button
				const button = buttonRef.current?.querySelector("a")
				if (button) {
					button.blur()
				}
			}
		}, [showModelSelector])

		// Function to show error message for unsupported files for drag and drop
		const showUnsupportedFileErrorMessage = () => {
			// Show error message for unsupported files
			setShowUnsupportedFileError(true)

			// Clear any existing timer
			if (unsupportedFileTimerRef.current) {
				clearTimeout(unsupportedFileTimerRef.current)
			}

			// Set timer to hide error after 3 seconds
			unsupportedFileTimerRef.current = setTimeout(() => {
				setShowUnsupportedFileError(false)
				unsupportedFileTimerRef.current = null
			}, 3000)
		}

		const handleDragEnter = (e: React.DragEvent) => {
			e.preventDefault()
			setIsDraggingOver(true)

			// Check if files are being dragged
			if (e.dataTransfer.types.includes("Files")) {
				// Check if any of the files are not images
				const items = Array.from(e.dataTransfer.items)
				const hasNonImageFile = items.some((item) => {
					if (item.kind === "file") {
						const type = item.type.split("/")[0]
						return type !== "image"
					}
					return false
				})

				if (hasNonImageFile) {
					showUnsupportedFileErrorMessage()
				}
			}
		}
		/**
		 * Handles the drag over event to allow dropping.
		 * Prevents the default behavior to enable drop.
		 *
		 * @param {React.DragEvent} e - The drag event.
		 */
		const onDragOver = (e: React.DragEvent) => {
			e.preventDefault()
			// Ensure state remains true if dragging continues over the element
			if (!isDraggingOver) {
				setIsDraggingOver(true)
			}
		}

		const handleDragLeave = (e: React.DragEvent) => {
			e.preventDefault()
			// Check if the related target is still within the drop zone; prevents flickering
			const dropZone = e.currentTarget as HTMLElement
			if (!dropZone.contains(e.relatedTarget as Node)) {
				setIsDraggingOver(false)
				// Don't clear the error message here, let it time out naturally
			}
		}

		// Effect to detect when drag operation ends outside the component
		useEffect(() => {
			const handleGlobalDragEnd = () => {
				// This will be triggered when the drag operation ends anywhere
				setIsDraggingOver(false)
				// Don't clear error message, let it time out naturally
			}

			document.addEventListener("dragend", handleGlobalDragEnd)

			return () => {
				document.removeEventListener("dragend", handleGlobalDragEnd)
			}
		}, [])

		/**
		 * Handles the drop event for files and text.
		 * Processes dropped images and text, updating the state accordingly.
		 *
		 * @param {React.DragEvent} e - The drop event.
		 */
		const onDrop = async (e: React.DragEvent) => {
			e.preventDefault()
			setIsDraggingOver(false) // Reset state on drop

			// Clear any error message when something is actually dropped
			setShowUnsupportedFileError(false)
			if (unsupportedFileTimerRef.current) {
				clearTimeout(unsupportedFileTimerRef.current)
				unsupportedFileTimerRef.current = null
			}

			// --- 1. VSCode Explorer Drop Handling ---
			let uris: string[] = []
			const resourceUrlsData = e.dataTransfer.getData("resourceurls")
			const vscodeUriListData = e.dataTransfer.getData("application/vnd.code.uri-list")

			// 1a. Try 'resourceurls' first (used for multi-select)
			if (resourceUrlsData) {
				try {
					uris = JSON.parse(resourceUrlsData)
					uris = uris.map((uri) => decodeURIComponent(uri))
				} catch (error) {
					console.error("Failed to parse resourceurls JSON:", error)
					uris = [] // Reset if parsing failed
				}
			}

			// 1b. Fallback to 'application/vnd.code.uri-list' (newline separated)
			if (uris.length === 0 && vscodeUriListData) {
				uris = vscodeUriListData.split("\n").map((uri) => uri.trim())
			}

			// 1c. Filter for valid schemes (file or vscode-file) and non-empty strings
			const validUris = uris.filter((uri) => uri && (uri.startsWith("vscode-file:") || uri.startsWith("file:")))

			if (validUris.length > 0) {
				setPendingInsertions([])
				let initialCursorPos = inputValue.length
				if (textAreaRef.current) {
					initialCursorPos = textAreaRef.current.selectionStart
				}
				setIntendedCursorPosition(initialCursorPos)

				FileServiceClient.getRelativePaths(RelativePathsRequest.create({ uris: validUris }))
					.then((response) => {
						if (response.paths.length > 0) {
							setPendingInsertions((prev) => [...prev, ...response.paths])
						}
					})
					.catch((error) => {
						console.error("Error getting relative paths:", error)
					})
				return
			}

			const text = e.dataTransfer.getData("text")
			if (text) {
				handleTextDrop(text)
				return
			}

			// --- 3. Image Drop Handling ---
			// Only proceed if it wasn't a VSCode resource or plain text drop
			const files = Array.from(e.dataTransfer.files)
			const acceptedTypes = ["png", "jpeg", "webp"]
			const imageFiles = files.filter((file) => {
				const [type, subtype] = file.type.split("/")
				return type === "image" && acceptedTypes.includes(subtype)
			})

			if (shouldDisableFilesAndImages || imageFiles.length === 0) {
				return
			}

			const imageDataArray = await readImageFiles(imageFiles)
			const dataUrls = imageDataArray.filter((dataUrl): dataUrl is string => dataUrl !== null)

			if (dataUrls.length > 0) {
				const filesAndImagesLength = selectedImages.length + selectedFiles.length
				const availableSlots = MAX_IMAGES_AND_FILES_PER_MESSAGE - filesAndImagesLength

				if (availableSlots > 0) {
					const imagesToAdd = Math.min(dataUrls.length, availableSlots)
					setSelectedImages((prevImages) => [...prevImages, ...dataUrls.slice(0, imagesToAdd)])
				}
			} else {
				console.warn("No valid images were processed")
			}
		}

		/**
		 * Handles the drop event for text.
		 * Inserts the dropped text at the current cursor position.
		 *
		 * @param {string} text - The dropped text.
		 */
		const handleTextDrop = (text: string) => {
			const newValue = inputValue.slice(0, cursorPosition) + text + inputValue.slice(cursorPosition)
			setInputValue(newValue)
			const newCursorPosition = cursorPosition + text.length
			setCursorPosition(newCursorPosition)
			setIntendedCursorPosition(newCursorPosition)
		}

		/**
		 * Reads image files and returns their data URLs.
		 * Uses FileReader to read the files as data URLs.
		 *
		 * @param {File[]} imageFiles - The image files to read.
		 * @returns {Promise<(string | null)[]>} - A promise that resolves to an array of data URLs or null values.
		 */
		const readImageFiles = (imageFiles: File[]): Promise<(string | null)[]> => {
			return Promise.all(
				imageFiles.map(
					(file) =>
						new Promise<string | null>((resolve) => {
							const reader = new FileReader()
							reader.onloadend = async () => {
								// Make async
								if (reader.error) {
									console.error("Error reading file:", reader.error)
									resolve(null)
								} else {
									const result = reader.result
									if (typeof result === "string") {
										try {
											await getImageDimensions(result) // Check dimensions
											resolve(result)
										} catch (error) {
											console.warn((error as Error).message)
											showDimensionErrorMessage() // Show error to user
											resolve(null) // Don't add this image
										}
									} else {
										resolve(null)
									}
								}
							}
							reader.readAsDataURL(file)
						}),
				),
			)
		}

		return (
			<div>
				<div
					style={{
						padding: "10px 10px",
						backgroundColor: chatTextAreaBackground,
						marginLeft: "8px",
						marginRight: "8px",
						marginBottom: "0px",
						marginTop: "-2px",
						opacity: 1,
						position: "relative",
						display: "flex",
						// Drag-over styles moved to DynamicTextArea
						transition: "background-color 0.1s ease-in-out, border 0.1s ease-in-out",
					}}
					onDrop={onDrop}
					onDragOver={onDragOver}
					onDragEnter={handleDragEnter}
					onDragLeave={handleDragLeave}>
					{showDimensionError && (
						<div
							style={{
								position: "absolute",
								inset: "10px 8px",
								backgroundColor: "rgba(var(--vscode-errorForeground-rgb), 0.1)",
								border: "1px solid var(--vscode-errorForeground)",
								borderRadius: 5,
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								zIndex: 10, // Ensure it's above other elements
								pointerEvents: "none",
							}}>
							<span
								style={{
									color: "var(--vscode-errorForeground)",
									//fontWeight: "bold",
									fontSize: "12px",
									textAlign: "center",
								}}>
								Image dimensions exceed 7500px
							</span>
						</div>
					)}
					{showUnsupportedFileError && (
						<div
							style={{
								position: "absolute",
								inset: "10px 8px",
								backgroundColor: "rgba(var(--vscode-errorForeground-rgb), 0.1)",
								border: "1px solid var(--vscode-errorForeground)",
								borderRadius: 5,
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								zIndex: 10,
								pointerEvents: "none",
							}}>
							<span
								style={{
									color: "var(--vscode-errorForeground)",
									//fontWeight: "bold",
									fontSize: "12px",
								}}>
								Files other than images are currently disabled
							</span>
						</div>
					)}
					{showSlashCommandsMenu && (
						<div ref={slashCommandsMenuContainerRef}>
							<SlashCommandMenu
								onSelect={handleSlashCommandsSelect}
								selectedIndex={selectedSlashCommandsIndex}
								setSelectedIndex={setSelectedSlashCommandsIndex}
								onMouseDown={handleMenuMouseDown}
								query={slashCommandsQuery}
								localWorkflowToggles={localWorkflowToggles}
								globalWorkflowToggles={globalWorkflowToggles}
							/>
						</div>
					)}

					{showContextMenu && (
						<div ref={contextMenuContainerRef}>
							<ContextMenu
								onSelect={handleMentionSelect}
								searchQuery={searchQuery}
								onMouseDown={handleMenuMouseDown}
								selectedIndex={selectedMenuIndex}
								setSelectedIndex={setSelectedMenuIndex}
								selectedType={selectedType}
								queryItems={queryItems}
								dynamicSearchResults={fileSearchResults}
								isLoading={searchLoading}
							/>
						</div>
					)}
					{!isTextAreaFocused && !activeQuote && (
						<div
							style={{
								position: "absolute",
								inset: "10px 7px",
								//border: "1px solid var(--vscode-input-border)",
								borderRadius: 5,
								pointerEvents: "none",
								zIndex: 5,
							}}
						/>
					)}
					<div
						ref={highlightLayerRef}
						style={{
							position: "absolute",
							top: 9,
							left: 2,
							right: 8,
							bottom: 10,
							pointerEvents: "none",
							whiteSpace: "pre-wrap",
							wordWrap: "break-word",
							color: "transparent",
							overflow: "hidden",
							backgroundColor: chatTextAreaBackground,
							fontFamily: "var(--vscode-font-family)",
							fontSize: "var(--vscode-editor-font-size)",
							lineHeight: "var(--vscode-editor-line-height)",
							borderRadius: 5,
							borderLeft: 0,
							borderRight: 0,
							borderTop: 0,
							borderColor: "transparent",
							borderBottom: `${thumbnailsHeight + 6}px solid transparent`,
							padding: "9px 28px 3px 9px",
							opacity: 0.6,
						}}
					/>
					<DynamicTextArea
						data-testid="chat-input"
						minRows={1}
						ref={(el) => {
							if (typeof ref === "function") {
								ref(el)
							} else if (ref) {
								ref.current = el
							}
							textAreaRef.current = el
						}}
						value={inputValue}
						onChange={(e) => {
							handleInputChange(e)
							updateHighlights()
						}}
						onKeyDown={handleKeyDown}
						onKeyUp={handleKeyUp}
						onFocus={() => {
							setIsTextAreaFocused(true)
							onFocusChange?.(true) // Call prop on focus
						}}
						onBlur={handleBlur}
						onPaste={handlePaste}
						onSelect={updateCursorPosition}
						onMouseUp={updateCursorPosition}
						onHeightChange={(height) => {
							if (textAreaBaseHeight === undefined || height < textAreaBaseHeight) {
								setTextAreaBaseHeight(height)
							}
							onHeightChange?.(height)
						}}
						placeholder={showUnsupportedFileError || showDimensionError ? "" : placeholderText}
						maxRows={10}
						autoFocus={true}
						style={{
							width: "100%",
							boxSizing: "border-box",
							marginLeft: -4,
							marginRight: -3,
							backgroundColor: "transparent",
							color: "var(--vscode-input-foreground)",
							//border: "1px solid var(--vscode-input-border)",
							borderRadius: 5,
							fontFamily: "var(--vscode-font-family)",
							fontSize: "var(--vscode-editor-font-size)",
							lineHeight: "var(--vscode-editor-line-height)",
							resize: "none",
							overflowX: "hidden",
							overflowY: "scroll",
							scrollbarWidth: "none",
							// Since we have maxRows, when text is long enough it starts to overflow the bottom padding, appearing behind the thumbnails. To fix this, we use a transparent border to push the text up instead. (https://stackoverflow.com/questions/42631947/maintaining-a-padding-inside-of-text-area/52538410#52538410)
							// borderTop: "9px solid transparent",
							borderLeft: 0,
							borderRight: 0,
							borderTop: 0,
							borderBottom: `${thumbnailsHeight}px solid transparent`,
							borderColor: "transparent",
							// borderRight: "54px solid transparent",
							// borderLeft: "9px solid transparent", // NOTE: react-textarea-autosize doesn't calculate correct height when using borderLeft/borderRight so we need to use horizontal padding instead
							// Instead of using boxShadow, we use a div with a border to better replicate the behavior when the textarea is focused
							// boxShadow: "0px 0px 0px 1px var(--vscode-input-border)",
							padding: "8px 28px 9px 5px",
							cursor: "text",
							flex: 1,
							zIndex: 1,
							outline:
								isDraggingOver && !showUnsupportedFileError // Only show drag outline if not showing error
									? "2px dashed var(--vscode-focusBorder)"
									: isTextAreaFocused
										? `0px dotted ${chatSettings.mode === "plan" ? PLAN_MODE_COLOR : ACT_MODE_COLOR}`
										: "none",
							outlineOffset: isDraggingOver && !showUnsupportedFileError ? "1px" : "0px", // Add offset for drag-over outline
						}}
						onScroll={() => updateHighlights()}
					/>
					{/* {!inputValue && selectedImages.length === 0 && selectedFiles.length === 0 && (
						<div className="absolute bottom-4 left-[25px] right-[60px] text-[10px] text-[var(--vscode-input-placeholderForeground)] opacity-70 whitespace-nowrap overflow-hidden text-ellipsis pointer-events-none z-[1]">
							Type @ for context, / for slash commands & workflows, hold shift to drag in files/images
						</div>
					)} */}
					{(selectedImages.length > 0 || selectedFiles.length > 0) && (
						<Thumbnails
							images={selectedImages}
							files={selectedFiles}
							setImages={setSelectedImages}
							setFiles={setSelectedFiles}
							onHeightChange={handleThumbnailsHeightChange}
							style={{
								position: "absolute",
								paddingTop: 4,
								bottom: 14,
								left: 8,
								right: 34,
								zIndex: 2,
							}}
						/>
					)}
					<div
						style={{
							position: "absolute",
							right: 12,
							display: "flex",
							alignItems: "flex-end",
							height: textAreaBaseHeight || 31,
							bottom: 10,
							zIndex: 2,
						}}>
						<div
							style={{
								display: "flex",
								flexDirection: "row",
								alignItems: "center",
							}}>
							{/* <div
								className={`input-icon-button ${shouldDisableImages ? "disabled" : ""} codicon codicon-device-camera`}
								onClick={() => {
									if (!shouldDisableImages) {
										onSelectImages()
									}
								}}
								style={{
									marginRight: 5.5,
									fontSize: 16.5,
								}}
							/> */}
							<div
								data-testid="send-button"
								className={`input-icon-button ${sendingDisabled ? "disabled" : ""} codicon codicon-arrow-circle-up`}
								onClick={() => {
									if (!sendingDisabled) {
										setIsTextAreaFocused(false)
										onSend()
									}
								}}
								style={{
									fontSize: 24,
									marginBottom: 4,
									marginRight: -6,
									color: inputValue
										? `${
												chatSettings.mode === "plan"
													? `color-mix(in srgb, ${PLAN_MODE_COLOR} 20%, var(--vscode-editor-foreground))`
													: `color-mix(in srgb, ${ACT_MODE_COLOR} 80%, var(--vscode-editor-foreground))`
											}`
										: undefined,
									opacity: inputValue ? 1 : 0.3,
									transition: "color 0.3s ease, opacity 0.3s ease",
								}}></div>
						</div>
					</div>
				</div>

				<ControlsContainer style={{ borderRadius: "0 0 10px 10px", backgroundColor: chatTextAreaBackground }}>
					<SwitchContainer
						style={{ marginTop: "1px", opacity: 0.8 }}
						data-testid="mode-switch"
						disabled={false}
						onClick={onModeToggle}>
						<Slider isAct={chatSettings.mode === "act"} isPlan={chatSettings.mode === "plan"} />
						<HeroTooltip delay={1000} content="Switch to Plan Mode">
							<SwitchOption
								isActive={chatSettings.mode === "plan"}
								onMouseOver={() => setShownTooltipMode("plan")}
								onMouseLeave={() => setShownTooltipMode(null)}>
								Plan
							</SwitchOption>
						</HeroTooltip>
						<HeroTooltip delay={1000} content="Switch to Act Mode">
							<SwitchOption
								isActive={chatSettings.mode === "act"}
								onMouseOver={() => setShownTooltipMode("act")}
								onMouseLeave={() => setShownTooltipMode(null)}>
								Act
							</SwitchOption>
						</HeroTooltip>
					</SwitchContainer>

					<ButtonGroup>
						<HeroTooltip delay={1000} content="Add to Context">
							<VSCodeButton
								data-testid="context-button"
								appearance="icon"
								aria-label="Add Context"
								onClick={handleContextButtonClick}
								style={{ marginLeft: "2px", paddingTop: "0px", height: "20px" }}>
								<ButtonContainer style={{ opacity: 0.7 }}>
									<span className="flex items-center" style={{ fontSize: "16px", marginBottom: 1 }}>
										@
									</span>
								</ButtonContainer>
							</VSCodeButton>
						</HeroTooltip>

						<HeroTooltip delay={1000} content="Execute Commands and Workflows">
							<VSCodeButton
								data-testid="command-button"
								appearance="icon"
								aria-label="Commands"
								onClick={handleCommandButtonClick}
								style={{ opacity: 0.7, marginLeft: "-2px", marginTop: "0px", height: "20px" }}>
								<ButtonContainer>
									<span
										className="codicon codicon-diff-ignored flex items-center"
										style={{ fontSize: "15px", marginTop: "2px" }}
									/>
								</ButtonContainer>
							</VSCodeButton>
						</HeroTooltip>

						<ClineRulesToggleModal textAreaRef={textAreaRef} />

						<ServersToggleModal textAreaRef={textAreaRef} />

						<HeroTooltip delay={1000} content="Select AI Provider / Model">
							<ModelContainer ref={modelSelectorRef} style={{ overflow: "hidden", position: "relative" }}>
								<div
									className="codicon codicon-sparkle-filled"
									style={{
										fontSize: "14px",
										color: itemIconColor,
										marginLeft: "0px",
										marginTop: "6px",
										opacity: 0.7,
										//overflow: "hidden",
										textOverflow: "ellipsis",
										whiteSpace: "nowrap",
									}}
								/>
								<ModelButtonWrapper ref={buttonRef}>
									<ModelDisplayButton
										style={{ fontSize: "11px", marginTop: "3px", marginLeft: "3px", marginRight: "3px" }}
										role="button"
										isActive={showModelSelector}
										disabled={false}
										onClick={handleModelButtonClick}
										tabIndex={0}>
										<ModelButtonContent>{modelDisplayName}</ModelButtonContent>
									</ModelDisplayButton>
								</ModelButtonWrapper>
								{showModelSelector && (
									<ModelSelectorTooltip
										arrowPosition={arrowPosition}
										menuPosition={menuPosition}
										style={{
											bottom: `calc(100vh - ${menuPosition}px + 6px)`,
											minHeight: "300px",
										}}>
										<div className="relative">
											<div
												onMouseDown={() => setShowModelSelector(false)}
												className="absolute top-0 right-0 cursor-pointer -m-0.5 z-[9999] pointer-events-auto">
												<span className="codicon codicon-close" />
											</div>
											<ApiOptions
												showModelOptions={true}
												apiErrorMessage={undefined}
												modelIdErrorMessage={undefined}
												isPopup={true}
											/>
										</div>
									</ModelSelectorTooltip>
								)}
								<HeroTooltip
									delay={1000}
									content="Attach files & images. File types are limited to specific formats that are compatible with the selected AI Provider / Model.">
									<VSCodeButton
										data-testid="files-button"
										appearance="icon"
										aria-label="Add Files & Images"
										disabled={shouldDisableFilesAndImages}
										onClick={() => {
											if (!shouldDisableFilesAndImages) {
												onSelectFilesAndImages()
											}
										}}
										style={{ padding: "0px 0px", height: "20px" }}>
										<ButtonContainer>
											<span
												className="codicon codicon-file-add flex items-center"
												style={{
													opacity: 0.6,
													//color: itemIconColor,
													fontWeight: "bold",
													fontSize: "15.5px",
													marginTop: 6,
													marginRight: 1.5,
													marginLeft: -2,
												}}
											/>
										</ButtonContainer>
									</VSCodeButton>
								</HeroTooltip>
							</ModelContainer>
						</HeroTooltip>
					</ButtonGroup>
				</ControlsContainer>
			</div>
		)
	},
)

// Update TypeScript interface for styled-component props
interface ModelSelectorTooltipProps {
	arrowPosition: number
	menuPosition: number
}

export default ChatTextArea
