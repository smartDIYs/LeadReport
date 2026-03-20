"use client";

import { Fragment, useState } from "react";

interface DrillDownReport {
  name: string;
  totalContacts: number;
  opportunityCount: number;
  customerCount: number;
  opportunityRate: number;
  customerRate: number;
}

interface TrafficSourceReport {
  source: string;
  sourceLabel: string;
  totalContacts: number;
  opportunityCount: number;
  customerCount: number;
  opportunityRate: number;
  customerRate: number;
  drillDown: DrillDownReport[];
}

interface ReportMeta {
  formsFound: string[];
  formsNotFound: string[];
  totalSubmissions: number;
  uniqueEmails: number;
  contactsMatched: number;
}

interface ReportResult {
  rows: TrafficSourceReport[];
  meta: ReportMeta;
}

export default function Home() {
  const today = new Date().toISOString().split("T")[0];
  const firstOfMonth = `${today.slice(0, 7)}-01`;

  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(today);
  const [report, setReport] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = (source: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(source)) {
        next.delete(source);
      } else {
        next.add(source);
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      setError("開始日と終了日を入力してください");
      return;
    }

    setLoading(true);
    setError("");
    setReport(null);
    setExpanded(new Set());

    try {
      const res = await fetch(
        `/api/report?startDate=${startDate}&endDate=${endDate}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "エラーが発生しました");
      setReport(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const totals = report?.rows.reduce(
    (acc, row) => ({
      totalContacts: acc.totalContacts + row.totalContacts,
      opportunityCount: acc.opportunityCount + row.opportunityCount,
      customerCount: acc.customerCount + row.customerCount,
    }),
    { totalContacts: 0, opportunityCount: 0, customerCount: 0 }
  );

  const totalOpportunityRate =
    totals && totals.totalContacts > 0
      ? Math.round((totals.opportunityCount / totals.totalContacts) * 1000) / 10
      : 0;
  const totalCustomerRate =
    totals && totals.totalContacts > 0
      ? Math.round((totals.customerCount / totals.totalContacts) * 1000) / 10
      : 0;

  return (
    <main className="min-h-screen p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">
        リード集計レポート
      </h1>

      <form onSubmit={handleSubmit} className="mb-8 flex items-end gap-4 flex-wrap">
        <div>
          <label
            htmlFor="startDate"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            開始日
          </label>
          <input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label
            htmlFor="endDate"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            終了日
          </label>
          <input
            id="endDate"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "集計中..." : "集計する"}
        </button>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6 text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-center py-12 text-gray-500">
          <div className="inline-block w-8 h-8 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin mb-3" />
          <p>HubSpot からデータを取得中...</p>
        </div>
      )}

      {report && (
        <>
          {/* Meta info */}
          <div className="bg-white border border-gray-200 rounded-md p-4 mb-6 text-sm text-gray-600 space-y-1">
            <p>
              <span className="font-medium">対象フォーム:</span>{" "}
              {report.meta.formsFound.length > 0
                ? report.meta.formsFound.join("、")
                : "なし"}
            </p>
            {report.meta.formsNotFound.length > 0 && (
              <p className="text-amber-600">
                <span className="font-medium">未検出フォーム:</span>{" "}
                {report.meta.formsNotFound.join("、")}
              </p>
            )}
            <p>
              <span className="font-medium">フォーム送信数:</span>{" "}
              {report.meta.totalSubmissions.toLocaleString()} 件 /
              ユニークメール: {report.meta.uniqueEmails.toLocaleString()} 件 /
              集計対象コンタクト: {report.meta.contactsMatched.toLocaleString()} 件
            </p>
            <p className="text-xs text-gray-400">
              ※ 新規コンタクト（指定期間内に作成）のみ集計。行をクリックすると詳細を展開できます。
            </p>
          </div>

          {report.rows.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              該当するデータがありません
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full bg-white border border-gray-200 rounded-md text-sm">
                <thead>
                  <tr className="bg-gray-100 text-left">
                    <th className="px-4 py-3 font-semibold border-b border-gray-200">
                      トラフィックソース
                    </th>
                    <th className="px-4 py-3 font-semibold border-b border-gray-200 text-right">
                      コンタクト数
                    </th>
                    <th className="px-4 py-3 font-semibold border-b border-gray-200 text-right">
                      商談数
                    </th>
                    <th className="px-4 py-3 font-semibold border-b border-gray-200 text-right">
                      商談移行率
                    </th>
                    <th className="px-4 py-3 font-semibold border-b border-gray-200 text-right">
                      顧客数
                    </th>
                    <th className="px-4 py-3 font-semibold border-b border-gray-200 text-right">
                      顧客移行率
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row) => {
                    const isExpanded = expanded.has(row.source);
                    const hasDrillDown = row.drillDown.length > 0;
                    return (
                      <Fragment key={row.source}>
                        <tr
                          className={`border-b border-gray-100 ${hasDrillDown ? "cursor-pointer hover:bg-blue-50" : "hover:bg-gray-50"} ${isExpanded ? "bg-blue-50" : ""}`}
                          onClick={() => hasDrillDown && toggleExpand(row.source)}
                        >
                          <td className="px-4 py-3 flex items-center gap-2">
                            {hasDrillDown && (
                              <span className="text-gray-400 text-xs w-4 inline-block flex-shrink-0">
                                {isExpanded ? "\u25BC" : "\u25B6"}
                              </span>
                            )}
                            <span className={isExpanded ? "font-semibold" : ""}>
                              {row.sourceLabel}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono">
                            {row.totalContacts.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right font-mono">
                            {row.opportunityCount.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right font-mono">
                            {row.opportunityRate}%
                          </td>
                          <td className="px-4 py-3 text-right font-mono">
                            {row.customerCount.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right font-mono">
                            {row.customerRate}%
                          </td>
                        </tr>
                        {isExpanded &&
                          row.drillDown.map((dd) => (
                            <tr
                              key={`${row.source}-${dd.name}`}
                              className="border-b border-gray-50 bg-gray-50/50"
                            >
                              <td className="px-4 py-2 pl-12 text-gray-500 text-xs">
                                {dd.name}
                              </td>
                              <td className="px-4 py-2 text-right font-mono text-xs text-gray-500">
                                {dd.totalContacts.toLocaleString()}
                              </td>
                              <td className="px-4 py-2 text-right font-mono text-xs text-gray-500">
                                {dd.opportunityCount.toLocaleString()}
                              </td>
                              <td className="px-4 py-2 text-right font-mono text-xs text-gray-500">
                                {dd.opportunityRate}%
                              </td>
                              <td className="px-4 py-2 text-right font-mono text-xs text-gray-500">
                                {dd.customerCount.toLocaleString()}
                              </td>
                              <td className="px-4 py-2 text-right font-mono text-xs text-gray-500">
                                {dd.customerRate}%
                              </td>
                            </tr>
                          ))}
                      </Fragment>
                    );
                  })}
                </tbody>
                {totals && (
                  <tfoot>
                    <tr className="bg-gray-50 font-semibold border-t-2 border-gray-300">
                      <td className="px-4 py-3">合計</td>
                      <td className="px-4 py-3 text-right font-mono">
                        {totals.totalContacts.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {totals.opportunityCount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {totalOpportunityRate}%
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {totals.customerCount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {totalCustomerRate}%
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </>
      )}
    </main>
  );
}
