import { NextRequest, NextResponse } from "next/server";
import { generateReport } from "@/lib/hubspot";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: "startDate と endDate パラメータが必要です" },
      { status: 400 }
    );
  }

  // Validate date format
  if (
    isNaN(Date.parse(startDate)) ||
    isNaN(Date.parse(endDate))
  ) {
    return NextResponse.json(
      { error: "日付の形式が正しくありません（YYYY-MM-DD）" },
      { status: 400 }
    );
  }

  try {
    const result = await generateReport(startDate, endDate);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "不明なエラーが発生しました";
    console.error("Report generation error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
