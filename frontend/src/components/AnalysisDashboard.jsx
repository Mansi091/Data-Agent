import { useState, useEffect } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import "./Mainpage.css";

function AnalysisDashboard({ summary, onBack }) {
  if (!summary) return null;

  // 1. States for tracking selected column and API response
  const [selectedColumn, setSelectedColumn] = useState(summary.column_names[0] || "");
  const [chartData, setChartData] = useState([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState(null);

  // 2. States for Data Cleaning & Export Tool
  const [activeTab, setActiveTab] = useState("overview");
  const [cleanLoading, setCleanLoading] = useState(false);
  const [cleanError, setCleanError] = useState(null);
  const [dropDuplicates, setDropDuplicates] = useState(false);
  const [fillMissing, setFillMissing] = useState({});
  const [removeOutliers, setRemoveOutliers] = useState([]);

  // 2. Fetch Aggregated Chart Data from Backend when selected column changes
  useEffect(() => {
    if (!selectedColumn) return;

    const fetchChartData = async () => {
      setChartLoading(true);
      setChartError(null);
      try {
        const url = `http://127.0.0.1:8000/chart-data?filename=${encodeURIComponent(
          summary.filename
        )}&column=${encodeURIComponent(selectedColumn)}`;

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error("Failed to fetch chart data");
        }
        const data = await response.json();
        setChartData(data);
      } catch (err) {
        console.error(err);
        setChartError(err.message);
      } finally {
        setChartLoading(false);
      }
    };

    fetchChartData();
  }, [selectedColumn, summary.filename]);

  // Handle fill missing selection changes
  const handleFillMissingChange = (column, strategy) => {
    setFillMissing(prev => ({
      ...prev,
      [column]: strategy
    }));
  };

  // Toggle outlier columns selection
  const toggleOutlierColumn = (column) => {
    setRemoveOutliers(prev => {
      if (prev.includes(column)) {
        return prev.filter(c => c !== column);
      } else {
        return [...prev, column];
      }
    });
  };

  // Send request to backend to clean data and download the result
  const handleCleanData = async () => {
    setCleanLoading(true);
    setCleanError(null);

    // Format clean fill_missing object (remove columns set to "none")
    const cleanedFillMissing = {};
    Object.keys(fillMissing).forEach(col => {
      if (fillMissing[col] && fillMissing[col] !== "none") {
        cleanedFillMissing[col] = fillMissing[col];
      }
    });

    try {
      const response = await fetch("http://127.0.0.1:8000/clean-data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: summary.filename,
          drop_duplicates: dropDuplicates,
          fill_missing: cleanedFillMissing,
          remove_outliers: removeOutliers
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Failed to clean dataset.");
      }

      // Build absolute URL to trigger browser download using FileResponse
      const downloadUrl = `http://127.0.0.1:8000/download?filename=${encodeURIComponent(data.filename)}`;
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.setAttribute("download", data.filename);
      document.body.appendChild(link);
      link.click();
      link.remove();

      alert(`Cleaning completed!\nOriginal Rows: ${data.original_rows}\nCleaned Rows: ${data.cleaned_rows}\n\nDownloaded file: ${data.filename}`);
    } catch (err) {
      console.error(err);
      setCleanError(err.message);
    } finally {
      setCleanLoading(false);
    }
  };

  return (
    <div className="mainpage-container">
      <div className="analysis-container">
        {/* Header */}
        <div className="analysis-header">
          <div>
            <h2 className="analysis-title">Dataset Analysis Summary</h2>
            <p className="analysis-filename">File: {summary.filename}</p>
          </div>
          <button className="back-btn" onClick={onBack}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Upload New
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="dashboard-tabs">
          <button
            className={`tab-btn ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            Overview
          </button>
          <button
            className={`tab-btn ${activeTab === "visualizer" ? "active" : ""}`}
            onClick={() => setActiveTab("visualizer")}
          >
            Visualizer
          </button>
          <button
            className={`tab-btn ${activeTab === "cleaner" ? "active" : ""}`}
            onClick={() => setActiveTab("cleaner")}
          >
            Clean & Export
          </button>
          <button
            className={`tab-btn ${activeTab === "health" ? "active" : ""}`}
            onClick={() => setActiveTab("health")}
          >
            Health Report
          </button>
          <button
            className={`tab-btn ${activeTab === "chat" ? "active" : ""}`}
            onClick={() => setActiveTab("chat")}
          >
            AI Chat
          </button>
        </div>

        {/* 1. Overview Tab */}
        {activeTab === "overview" && (
          <>
            {/* Metric Dashboard */}
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-label">Total Rows</div>
                <div className="metric-value">{summary.total_rows.toLocaleString()}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Total Columns</div>
                <div className="metric-value">{summary.total_cols}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Duplicates</div>
                <div className="metric-value">{summary.duplicate_rows}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">RAM Usage</div>
                <div className="metric-value">{summary.memory_usage} KB</div>
              </div>
            </div>

            {/* Data Table Preview */}
            <div className="preview-section">
              <h3 className="preview-title">Dataset Preview (First 5 Rows)</h3>
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      {summary.column_names.map((colName, index) => (
                        <th key={index}>{colName}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {summary.preview.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {summary.column_names.map((colName, colIndex) => (
                          <td key={colIndex}>
                            {row[colName] !== null && row[colName] !== undefined
                              ? String(row[colName])
                              : ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* 2. Visualizer Tab */}
        {activeTab === "visualizer" && (
          <div className="chart-card">
            <div className="chart-header">
              <h3 className="preview-title" style={{ margin: 0 }}>Data Distribution</h3>

              <div className="chart-selector">
                <label htmlFor="column-select" style={{ fontSize: "14px", fontWeight: "600" }}>Visualize Column: </label>
                <select
                  id="column-select"
                  value={selectedColumn}
                  onChange={(e) => setSelectedColumn(e.target.value)}
                  className="column-dropdown"
                >
                  {summary.column_names.map((colName) => (
                    <option key={colName} value={colName}>
                      {colName} ({summary.data_types[colName]})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {chartLoading ? (
              <div className="chart-loading">
                <svg className="spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite', marginRight: '8px' }}>
                  <line x1="12" y1="2" x2="12" y2="6" />
                  <line x1="12" y1="18" x2="12" y2="22" />
                  <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
                  <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
                  <line x1="2" y1="12" x2="6" y2="12" />
                  <line x1="18" y1="12" x2="22" y2="12" />
                  <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
                  <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
                </svg>
                Loading distribution data...
              </div>
            ) : chartError ? (
              <div className="chart-error">Error loading chart: {chartError}</div>
            ) : chartData.length > 0 ? (
              <div style={{ width: "100%", height: 350 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      stroke="var(--text)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: "var(--border)" }}
                    />
                    <YAxis
                      stroke="var(--text)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: "var(--border)" }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--bg)",
                        border: "1px solid var(--border)",
                        borderRadius: "12px",
                        color: "var(--text-h)",
                        boxShadow: "var(--shadow)"
                      }}
                      cursor={{ fill: "var(--accent-bg)", opacity: 0.4 }}
                    />
                    <Bar dataKey="value" fill="var(--accent)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="chart-empty">No distribution data available for this column.</div>
            )}
          </div>
        )}

        {/* 3. Cleaner Tab */}
        {activeTab === "cleaner" && (
          <div className="chart-card cleaning-card">
            <div className="chart-header">
              <h3 className="preview-title" style={{ margin: 0 }}>Data cleaning and export</h3>
            </div>

            <div className="cleaning-options">
              {/* Action 1: Duplicates */}
              <div className="cleaning-row">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={dropDuplicates}
                    onChange={(e) => setDropDuplicates(e.target.checked)}
                  />
                  Remove Duplicate Rows (Currently detected: {summary.duplicate_rows} duplicate rows)
                </label>
              </div>

              {/* Action 2: Fill Missing Values */}
              <div className="cleaning-section-title">Fill Missing Values</div>
              <div className="cleaning-grid">
                {summary.column_names.map((colName) => {
                  const colHealth = summary.health_check?.[colName];
                  const missingCount = colHealth?.missing?.empty_count || 0;
                  const isNumeric = summary.data_types[colName].includes("int") ||
                    summary.data_types[colName].includes("float") ||
                    summary.data_types[colName].includes("num") ||
                    summary.data_types[colName].includes("double");

                  return (
                    <div key={colName} className="cleaning-column-row">
                      <span className="col-name">{colName} <code>({summary.data_types[colName]})</code></span>
                      <span className="col-missing">{missingCount > 0 ? `${missingCount} missing values (${colHealth.missing.percentage}%)` : "No missing values"}</span>
                      <select
                        value={fillMissing[colName] || "none"}
                        onChange={(e) => handleFillMissingChange(colName, e.target.value)}
                        className="column-dropdown cleaning-select"
                        disabled={missingCount === 0}
                      >
                        <option value="none">Don't Fill</option>
                        {isNumeric && <option value="mean">Fill with Mean</option>}
                        {isNumeric && <option value="median">Fill with Median</option>}
                        <option value="mode">Fill with Mode (Most Frequent)</option>
                        <option value="constant">Fill with Constant (0 / 'Unknown')</option>
                      </select>
                    </div>
                  );
                })}
              </div>

              {/* Action 3: Filter Outliers */}
              <div className="cleaning-section-title" style={{ marginTop: "20px" }}>Remove Outliers (IQR Method)</div>
              <div className="outliers-grid">
                {summary.column_names
                  .filter(colName => {
                    const colHealth = summary.health_check?.[colName];
                    return colHealth?.outliers !== null && colHealth?.outliers !== undefined;
                  })
                  .map(colName => {
                    const colHealth = summary.health_check[colName];
                    const outlierCount = colHealth.outliers?.outlier_count || 0;
                    return (
                      <label key={colName} className="checkbox-label outlier-checkbox" disabled={outlierCount === 0}>
                        <input
                          type="checkbox"
                          disabled={outlierCount === 0}
                          checked={removeOutliers.includes(colName)}
                          onChange={() => toggleOutlierColumn(colName)}
                        />
                        <span className="col-name">{colName}</span>
                        <span className="col-missing" style={{ color: "var(--text)" }}>({outlierCount} outliers)</span>
                      </label>
                    );
                  })}
              </div>

              {/* Clean & Export Button */}
              <button
                onClick={handleCleanData}
                disabled={cleanLoading}
                className="upload-btn clean-btn"
                style={{ marginTop: "25px" }}
              >
                {cleanLoading ? (
                  <>
                    <svg className="spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite', marginRight: '8px', display: 'inline-block', verticalAlign: 'middle' }}>
                      <line x1="12" y1="2" x2="12" y2="6" />
                      <line x1="12" y1="18" x2="12" y2="22" />
                      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
                      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
                      <line x1="2" y1="12" x2="6" y2="12" />
                      <line x1="18" y1="12" x2="22" y2="12" />
                      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
                      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
                    </svg>
                    Processing Clean & Export...
                  </>
                ) : "Clean & Download Dataset"}
              </button>

              {cleanError && (
                <div className="status-message error" style={{ marginTop: "15px" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>Error: {cleanError}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 4. Health Tab */}
        {activeTab === "health" && summary.health_check && (
          <div className="health-section" style={{ marginTop: 0 }}>
            <h3 className="preview-title">Data Quality & Health Report</h3>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Column Name</th>
                    <th>Data Type</th>
                    <th>Missing Values</th>
                    <th>Unique Values / Category</th>
                    <th>Outliers Detected</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.column_names.map((colName, index) => {
                    const colHealth = summary.health_check[colName];
                    if (!colHealth) return null;
                    return (
                      <tr key={index}>
                        <td><strong>{colName}</strong></td>
                        <td><code>{summary.data_types[colName]}</code></td>
                        <td>
                          {colHealth.missing.percentage}% ({colHealth.missing.empty_count} rows)
                          {colHealth.missing.is_mostly_empty && (
                            <span className="badge badge-danger">Mostly Empty</span>
                          )}
                        </td>
                        <td>
                          {colHealth.cardinality.unique_count} unique
                          <span className="badge badge-info">{colHealth.cardinality.category_type}</span>
                        </td>
                        <td>
                          {colHealth.outliers ? (
                            colHealth.outliers.outlier_count > 0 ? (
                              <span className="badge badge-warning">
                                {colHealth.outliers.outlier_count} outliers ({colHealth.outliers.percentage}%)
                              </span>
                            ) : (
                              "None"
                            )
                          ) : (
                            <span style={{ color: "var(--text)", opacity: 0.5 }}>N/A (Non-numeric)</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 5. AI Chat Tab Placeholder */}
        {activeTab === "chat" && (
          <div className="chart-card">
            <div className="chart-header">
              <h3 className="preview-title" style={{ margin: 0 }}>AI Data Assistant</h3>
            </div>
            <div className="chart-empty" style={{ border: "1px dashed var(--border)", background: "var(--social-bg)", borderRadius: "12px", height: "300px" }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: "12px", color: "var(--accent)" }}>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <div>
                <p style={{ fontWeight: "600", color: "var(--text-h)", marginBottom: "4px" }}>AI Chat is Coming Next!</p>
                <p style={{ fontSize: "13px", color: "var(--text)", maxWidth: "300px", margin: "0 auto" }}>We will connect this tab to a RAG pipeline so you can query your dataset in plain English.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AnalysisDashboard;
