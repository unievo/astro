import * as path from "path"
import * as vscode from "vscode"
import fs from "fs/promises"
import { Anthropic } from "@anthropic-ai/sdk"
import { fileExistsAtPath } from "../../utils/fs"
import { ClineMessage } from "../../shared/ExtensionMessage"
import { TaskMetadata } from "../context/context-tracking/ContextTrackerTypes"
import {
	apiConversationHistoryFile,
	contextHistoryFile,
	mcpSettingsFile,
	openRouterModelsFile,
	rulesFile,
	taskMetadataFile,
	uiMessagesFile,
} from "../../shared/Configuration"
export const GlobalFileNames = {
	apiConversationHistory: apiConversationHistoryFile,
	contextHistory: contextHistoryFile,
	uiMessages: uiMessagesFile,
	openRouterModels: openRouterModelsFile,
	mcpSettings: mcpSettingsFile,
	clineRules: rulesFile,
	taskMetadata: taskMetadataFile,
}

export async function ensureTaskDirectoryExists(context: vscode.ExtensionContext, taskId: string): Promise<string> {
	const globalStoragePath = context.globalStorageUri.fsPath
	const taskDir = path.join(globalStoragePath, "tasks", taskId)
	await fs.mkdir(taskDir, { recursive: true })
	return taskDir
}

export async function getSavedApiConversationHistory(
	context: vscode.ExtensionContext,
	taskId: string,
): Promise<Anthropic.MessageParam[]> {
	const filePath = path.join(await ensureTaskDirectoryExists(context, taskId), GlobalFileNames.apiConversationHistory)
	const fileExists = await fileExistsAtPath(filePath)
	if (fileExists) {
		return JSON.parse(await fs.readFile(filePath, "utf8"))
	}
	return []
}

export async function saveApiConversationHistory(
	context: vscode.ExtensionContext,
	taskId: string,
	apiConversationHistory: Anthropic.MessageParam[],
) {
	try {
		const filePath = path.join(await ensureTaskDirectoryExists(context, taskId), GlobalFileNames.apiConversationHistory)
		await fs.writeFile(filePath, JSON.stringify(apiConversationHistory))
	} catch (error) {
		// in the off chance this fails, we don't want to stop the task
		console.error("Failed to save API conversation history:", error)
	}
}

export async function getSavedClineMessages(context: vscode.ExtensionContext, taskId: string): Promise<ClineMessage[]> {
	const filePath = path.join(await ensureTaskDirectoryExists(context, taskId), GlobalFileNames.uiMessages)
	if (await fileExistsAtPath(filePath)) {
		return JSON.parse(await fs.readFile(filePath, "utf8"))
	} else {
		// check old location
		const oldPath = path.join(await ensureTaskDirectoryExists(context, taskId), "claude_messages.json")
		if (await fileExistsAtPath(oldPath)) {
			const data = JSON.parse(await fs.readFile(oldPath, "utf8"))
			await fs.unlink(oldPath) // remove old file
			return data
		}
	}
	return []
}

export async function saveClineMessages(context: vscode.ExtensionContext, taskId: string, uiMessages: ClineMessage[]) {
	try {
		const taskDir = await ensureTaskDirectoryExists(context, taskId)
		const filePath = path.join(taskDir, GlobalFileNames.uiMessages)
		await fs.writeFile(filePath, JSON.stringify(uiMessages))
	} catch (error) {
		console.error("Failed to save ui messages:", error)
	}
}

export async function getTaskMetadata(context: vscode.ExtensionContext, taskId: string): Promise<TaskMetadata> {
	const filePath = path.join(await ensureTaskDirectoryExists(context, taskId), GlobalFileNames.taskMetadata)
	try {
		if (await fileExistsAtPath(filePath)) {
			return JSON.parse(await fs.readFile(filePath, "utf8"))
		}
	} catch (error) {
		console.error("Failed to read task metadata:", error)
	}
	return { files_in_context: [], model_usage: [] }
}

export async function saveTaskMetadata(context: vscode.ExtensionContext, taskId: string, metadata: TaskMetadata) {
	try {
		const taskDir = await ensureTaskDirectoryExists(context, taskId)
		const filePath = path.join(taskDir, GlobalFileNames.taskMetadata)
		await fs.writeFile(filePath, JSON.stringify(metadata, null, 2))
	} catch (error) {
		console.error("Failed to save task metadata:", error)
	}
}
