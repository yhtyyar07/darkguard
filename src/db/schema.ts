import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  serial,
  varchar,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Sublinks table - stores VPN subscription links
export const sublinks = pgTable(
  "sublinks",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull().unique(),
    url: text("url").notNull(),
    format: varchar("format", { length: 50 }).notNull(), // base64, raw, json, text
    status: varchar("status", { length: 50 }).default("active"), // active, disabled
    servers: jsonb("servers").default([]), // Array of server objects
    serverCount: integer("server_count").default(0),
    lastRefreshed: timestamp("last_refreshed").defaultNow(),
    lastRequested: timestamp("last_requested"),
    headers: jsonb("headers"), // Store headers from sublink response
    expireDate: timestamp("expire_date"),
    remainingQuota: integer("remaining_quota"), // In GB or -1 for unlimited
    totalQuota: integer("total_quota"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    nameIndex: index("sublinks_name_idx").on(table.name),
    statusIndex: index("sublinks_status_idx").on(table.status),
  })
);

// Users table
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    username: varchar("username", { length: 255 }).notNull().unique(),
    status: varchar("status", { length: 50 }).default("active"), // active, disabled, expired
    expiryDate: timestamp("expiry_date").notNull(),
    sublinkIds: jsonb("sublink_ids").default([]), // Array of associated sublink IDs
    shortUrl: varchar("short_url", { length: 10 }).unique(), // 6-char unique code (e.g., df-ah-hy)
    base64Data: text("base64_data"), // Latest generated base64 subscription data
    googleDriveFolderId: varchar("google_drive_folder_id", { length: 255 }),
    googleDriveFileId: varchar("google_drive_file_id", { length: 255 }),
    googleDriveUrl: text("google_drive_url"),
    lastRequested: timestamp("last_requested"),
    requestCount: integer("request_count").default(0),
    notes: text("notes"),
    firebaseDocId: varchar("firebase_doc_id", { length: 255 }), // Reference to Firestore document
    firebaseSyncedAt: timestamp("firebase_synced_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    usernameIndex: index("users_username_idx").on(table.username),
    statusIndex: index("users_status_idx").on(table.status),
    shortUrlIndex: index("users_short_url_idx").on(table.shortUrl),
    expiryIndex: index("users_expiry_date_idx").on(table.expiryDate),
  })
);

// Admin/Settings table
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 255 }).notNull().unique(),
  value: text("value").notNull(),
  type: varchar("type", { length: 50 }), // string, json, number, boolean
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Logs table for audit trail
export const logs = pgTable(
  "logs",
  {
    id: serial("id").primaryKey(),
    level: varchar("level", { length: 50 }).notNull(), // info, warning, error, success
    category: varchar("category", { length: 100 }).notNull(), // sublink_refresh, firestore_sync, user_action, system_error
    message: text("message").notNull(),
    userId: integer("user_id"), // Optional reference to user
    sublinkId: integer("sublink_id"), // Optional reference to sublink
    metadata: jsonb("metadata"), // Additional data
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    levelIndex: index("logs_level_idx").on(table.level),
    categoryIndex: index("logs_category_idx").on(table.category),
    createdAtIndex: index("logs_created_at_idx").on(table.createdAt),
  })
);

// Refresh history table to track sublink refresh jobs
export const refreshHistory = pgTable(
  "refresh_history",
  {
    id: serial("id").primaryKey(),
    sublinkId: integer("sublink_id").notNull(),
    status: varchar("status", { length: 50 }).notNull(), // success, failed, pending
    serversBefore: integer("servers_before"),
    serversAfter: integer("servers_after"),
    duration: integer("duration"), // in milliseconds
    error: text("error"), // Error message if failed
    affectedUsers: integer("affected_users"), // How many users were updated
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    sublinkIdIndex: index("refresh_history_sublink_id_idx").on(
      table.sublinkId
    ),
    statusIndex: index("refresh_history_status_idx").on(table.status),
  })
);

// Cache table for storing parsed subscription data temporarily
export const cache = pgTable(
  "cache",
  {
    id: serial("id").primaryKey(),
    key: varchar("key", { length: 255 }).notNull().unique(),
    value: jsonb("value").notNull(),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    expiresAtIndex: index("cache_expires_at_idx").on(table.expiresAt),
  })
);
