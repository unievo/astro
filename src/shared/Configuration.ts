// Configuration constants from package.json
import { name, publisher } from "../../package.json"

// Base
export const baseName = "Cline"
export const baseVersion = "v3.46.1"
export const baseVersionUrl = `https://github.com/cline/cline/blob/main/CHANGELOG.md#3461`

// Product
export const agentName = "Astro"
export const productName = "astro"
export const authorName = "unievo"
export const publishedName = name
export const publisherName = publisher
export const xUrl = "https://x.com/unievo_ai"
export const discordUrl = ""
export const repoUrl = "https://github.com/unievo/astro"
export const homePageUrl = "https://github.com/unievo/astro"
export const avatarUrl = "https://raw.githubusercontent.com/unievo/astro/main/assets/icons/icon_neutral.png"
export const gitInstructionsRepo = ""
export const gitWorkflowsRepo = ""

// Settings
export const enableDictation = false
export const enableYoloMode = true
export const enableTelemetrySettings = false
export const maxHistoryPreviewItems = 9
export const mcpLibraryEnabled = false
export const enableNewInstructionsDefaultSetting = false
export const mcpServerIncludeFullSchema_ToolsMaxCount = 5
export const mcpServerIncludeToolInputSchema_MaxLength = 100

// Files & Folders
export const homeRootDirectory = `.${authorName}`
export const agentWorkspaceDirectory = `.${productName}`
export const instructionsDirectory = `instructions`
export const workflowsDirectory = `workflows`
export const hooksDirectory = `hooks`
export const instructionsFilesExtension = `.md`
export const instructionsExcludedDirectories = [".*", "content"]
export const instructionsExcludedFiles = ["README.md"]
export const settingsDirectory = `settings`
export const mcpDirectory = `mcp`
export const mcpServersDirectory = `servers`
export const mcpSettingsFile = `mcp_settings.json`
export const ignoreFile = `.${productName}ignore`
export const extensionIconLightPath = ["assets", "icons", "icon_light.png"]
export const extensionIconDarkPath = ["assets", "icons", "icon_dark.png"]
export const ignoreWorkspaceDirectories = [
	agentWorkspaceDirectory,
	".git",
	".github",
	"node_modules",
	"__pycache__",
	"env",
	".env",
	"venv",
	".venv",
	".cache",
	"target",
	"build",
	"debug",
	"release",
	"dist",
	"out",
	"bundle",
	"vendor",
	"tmp",
	"temp",
	"deps",
	"pkg",
	"Pods",
]
