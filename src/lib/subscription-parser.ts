/**
 * Parses subscription data in various formats (base64, raw, json, text)
 * Extracts VLESS, VMESS, Hysteria2, Shadowsocks protocols
 */

export interface ParsedServer {
  protocol: string; // vless, vmess, hysteria2, shadowsocks, trojan
  name: string;
  originalString: string;
  server?: string;
  port?: number;
  enabled?: boolean;
}

export function normalizeServerName(name: string): string {
  let decodedName = name.trim();
  try {
    decodedName = decodeURIComponent(decodedName);
  } catch {
    // Keep malformed upstream fragments readable as-is.
  }

  return decodedName
    .replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}\uFE0F\u200D]/gu, "")
    .replace(/[\u0000-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s,;|_-]+|[\s,;|_-]+$/g, "");
}

export class SubscriptionParser {
  /**
   * Detects and parses subscription format
   */
  static async parseSubscription(data: string): Promise<ParsedServer[]> {
    try {
      const compactData = data.replace(/\s/g, "");
      const isBase64 =
        compactData.length > 0 &&
        compactData.length % 4 !== 1 &&
        /^[A-Za-z0-9+/]*={0,2}$/.test(compactData) &&
        Buffer.from(compactData, "base64")
          .toString("base64")
          .replace(/=+$/, "") === compactData.replace(/=+$/, "");
      const decoded = isBase64
        ? Buffer.from(compactData, "base64").toString("utf-8")
        : data;

      // Split by newlines
      const lines = decoded
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      const servers: ParsedServer[] = [];

      for (const line of lines) {
        // Skip comments
        if (line.startsWith("#") || line.startsWith("//")) continue;

        const server = this.parseServerLine(line);
        if (server) {
          servers.push(server);
        }
      }

      return servers;
    } catch (error) {
      console.error("Subscription parsing error:", error);
      return [];
    }
  }

  /**
   * Parses individual server line (VLESS, VMESS, Hysteria2, etc.)
   */
  private static parseServerLine(line: string): ParsedServer | null {
    try {
      // Extract protocol
      const protocolMatch = line.match(/^([a-z0-9]+):\/\//i);
      if (!protocolMatch) return null;

      const protocol = protocolMatch[1].toLowerCase();

      // Basic parsing - extract server name (usually in fragment or comment)
      let name = `${protocol}-server`;
      const nameMatch = line.match(/#([^#]+)$/);
      if (nameMatch) {
        name = normalizeServerName(nameMatch[1]) || name;
      }

      // Try to extract server address
      let server = "unknown";
      const addressMatch = line.match(
        /(?:vless|vmess|hysteria2|trojan|ss):\/\/([^:@/]+)/i
      );
      if (addressMatch) {
        server = addressMatch[1];
      }

      // Try to extract port
      let port = 443;
      const portMatch = line.match(/:(\d+)(?:[/?#]|$)/);
      if (portMatch) {
        port = parseInt(portMatch[1], 10);
      }

      return {
        protocol,
        name,
        originalString: line,
        server,
        port,
        enabled: true,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Converts parsed servers back to subscription format (base64)
   */
  static toBase64(servers: ParsedServer[]): string {
    const lines = servers
      .filter((s) => s.enabled !== false)
      .map((s) => s.originalString);
    return Buffer.from(lines.join("\n")).toString("base64");
  }

  /**
   * Filters servers based on enabled status
   */
  static filterEnabledServers(servers: ParsedServer[]): ParsedServer[] {
    return servers.filter((s) => s.enabled !== false);
  }

  /**
   * Counts total servers
   */
  static countServers(servers: ParsedServer[]): number {
    return servers.length;
  }
}
