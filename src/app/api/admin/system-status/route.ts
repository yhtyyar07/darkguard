import { NextRequest, NextResponse } from "next/server";
import { statfs } from "node:fs/promises";
import { cpus, freemem, totalmem } from "node:os";
import { verifyRequestToken } from "@/lib/auth";
import {
  checkFirebaseConnection,
  getCachedFirebaseConnectionStatus,
  type FirebaseConnectionStatus,
} from "@/lib/firebase";

function cpuSnapshot() {
  return cpus().reduce(
    (snapshot, cpu) => {
      const values = Object.values(cpu.times);
      snapshot.total += values.reduce((sum, value) => sum + value, 0);
      snapshot.idle += cpu.times.idle;
      return snapshot;
    },
    { total: 0, idle: 0 }
  );
}

async function sampleCpuUsage() {
  const before = cpuSnapshot();
  await new Promise((resolve) => setTimeout(resolve, 220));
  const after = cpuSnapshot();
  const total = after.total - before.total;
  const idle = after.idle - before.idle;
  return total > 0 ? Math.round(((total - idle) / total) * 1000) / 10 : 0;
}

export async function GET(request: NextRequest) {
  if (!verifyRequestToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [cpuPercent, filesystem] = await Promise.all([
      sampleCpuUsage(),
      statfs("/"),
    ]);
    const firestore: FirebaseConnectionStatus =
      getCachedFirebaseConnectionStatus() || {
        status: process.env.FIREBASE_SERVICE_ACCOUNT_KEY ? "checking" : "not_configured",
        projectId: null,
        message: "Firestore status is checked in the background",
      };
    void checkFirebaseConnection();

    const memoryTotal = totalmem();
    const memoryUsed = memoryTotal - freemem();
    const storageTotal = filesystem.blocks * filesystem.bsize;
    const storageAvailable = filesystem.bavail * filesystem.bsize;
    const storageUsed = storageTotal - storageAvailable;

    return NextResponse.json({
      cpu: { percent: cpuPercent, cores: cpus().length },
      memory: {
        usedBytes: memoryUsed,
        totalBytes: memoryTotal,
        percent: memoryTotal > 0 ? Math.round((memoryUsed / memoryTotal) * 1000) / 10 : 0,
      },
      storage: {
        usedBytes: storageUsed,
        totalBytes: storageTotal,
        percent: storageTotal > 0 ? Math.round((storageUsed / storageTotal) * 1000) / 10 : 0,
      },
      firestore,
      sampledAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("System status error:", error);
    return NextResponse.json({ error: "Could not read system status" }, { status: 500 });
  }
}