import { pgTable, text, serial, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/**
 * Language Elements Table
 * Stores the core building blocks of the ChimPrompt language
 * Examples: "in", "for", "context", "line", etc.
 */
export const languageElements = pgTable("language_elements", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description").notNull(),
  example: text("example").notNull(),
  category: text("category").notNull(),
});

/**
 * Saved Codes Table
 * Stores user's saved code snippets with privacy settings
 * Examples: 
 * contextId: "context:1" - for private codes
 * chimContextId: "chimcontext:A1" - for public codes, A prefix indicates public availability
 */
export const savedCodes = pgTable("saved_codes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  content: text("content").notNull(),
  isPublic: boolean("is_public").default(false),
  contextId: text("context_id").notNull(),
  chimContextId: text("chim_context_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

/**
 * Saved Prompts Table
 * Stores user's ChimPrompt patterns with privacy settings
 * Examples:
 * promptId: "prompt:1" - for private prompts
 * chimPromptId: "chimprompt:A1" - for public prompts, A prefix indicates public availability
 */
export const savedPrompts = pgTable("saved_prompts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  content: text("content").notNull(),
  isPublic: boolean("is_public").default(false),
  promptId: text("prompt_id").notNull(),
  chimPromptId: text("chim_prompt_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

/**
 * Schema for inserting new language elements
 * Validates that name, description, example, and category are provided
 */
export const insertLanguageElementSchema = createInsertSchema(languageElements).pick({
  name: true,
  description: true,
  example: true,
  category: true,
});

/**
 * Schema for inserting new saved codes
 * Validates code content and name, allows setting public/private status
 * Example: { name: "Search Bar Code", content: "*in* react | *create* search bar", isPublic: false }
 */
export const insertSavedCodeSchema = createInsertSchema(savedCodes)
  .pick({
    name: true,
    content: true,
    isPublic: true,
  })
  .extend({
    content: z.string().min(1, "Code content is required"),
    name: z.string().min(1, "Name is required"),
  });

/**
 * Schema for inserting new saved prompts
 * Validates prompt content and name, allows setting public/private status
 * Example: { name: "Instagram Search Bar", content: "*in* swift | *for* iphone | *create* search", isPublic: true }
 */
export const insertSavedPromptSchema = createInsertSchema(savedPrompts)
  .pick({
    name: true,
    content: true,
    isPublic: true,
  })
  .extend({
    content: z.string().min(1, "Prompt content is required"),
    name: z.string().min(1, "Name is required"),
  });

export type InsertLanguageElement = z.infer<typeof insertLanguageElementSchema>;
export type LanguageElement = typeof languageElements.$inferSelect;
export type InsertSavedCode = z.infer<typeof insertSavedCodeSchema>;
export type SavedCode = typeof savedCodes.$inferSelect;
export type InsertSavedPrompt = z.infer<typeof insertSavedPromptSchema>;
export type SavedPrompt = typeof savedPrompts.$inferSelect;