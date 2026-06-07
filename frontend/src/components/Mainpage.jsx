import { useState, useRef } from "react";
import "./Mainpage.css";

function Mainpage() {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState(""); // "", "info", "success", "error"
  const [isDragActive, setIsDragActive] = useState(false);
  const [summary, setSummary] = useState(null); // Stores backend analysis response
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setMessage("");
      setStatus("");
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith(".csv")) {
        setFile(droppedFile);
        setMessage("");
        setStatus("");
      } else {
        setMessage("Only CSV files are allowed");
        setStatus("error");
      }
    }
  };

  const onButtonClick = () => {
    fileInputRef.current.click();
  };

  const removeFile = () => {
    setFile(null);
    setMessage("");
    setStatus("");
  };

  const resetUploader = () => {
    setFile(null);
    setMessage("");
    setStatus("");
    setSummary(null);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage("Please select a CSV file first");
      setStatus("error");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setMessage("Uploading and analyzing file...");
      setStatus("info");

      const response = await fetch("http://127.0.0.1:8000/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Upload failed");
        setStatus("error");
        return;
      }

      setSummary(data); // Save the analysis summary
      setMessage("File uploaded and analyzed successfully!");
      setStatus("success");
      console.log("Backend response:", data);
    } catch (error) {
      console.error(error);
      setMessage(`Something went wrong: ${error.message}`);
      setStatus("error");
    }
  };

  // If file has been successfully uploaded and analyzed, show the Results Dashboard
  if (summary) {
    return (
      <div className="mainpage-container">
        <div className="analysis-container">
          <div className="analysis-header">
            <div>
              <h2 className="analysis-title">Dataset Analysis Summary</h2>
              <p className="analysis-filename">File: {summary.filename}</p>
            </div>
            <button className="back-btn" onClick={resetUploader}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              Upload New
            </button>
          </div>

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

          {/* Data Quality & Health Report */}
          {summary.health_check && (
            <div className="health-section">
              <h3 className="preview-title" style={{ marginTop: "30px" }}>Data Quality & Health Report</h3>
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
        </div>

      </div>
    );
  }

  // Otherwise, show the default drag-and-drop file uploader card
  return (
    <div className="mainpage-container">
      <div className="upload-card">
        <h2 className="upload-title">AI Data Agent</h2>
        <p className="upload-subtitle">Upload your CSV datasets for intelligent analysis</p>

        <div
          className={`dropzone ${isDragActive ? "active" : ""}`}
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={onButtonClick}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="file-input"
            accept=".csv"
            onChange={handleFileChange}
          />

          <svg className="dropzone-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>

          <p className="dropzone-text">Drag & drop your CSV file here</p>
          <p className="dropzone-subtext">or click to browse files</p>
        </div>

        {file && (
          <div className="selected-file-info">
            <div className="file-details">
              <svg className="file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              <div>
                <div className="file-name">{file.name}</div>
                <div className="file-size">{formatFileSize(file.size)}</div>
              </div>
            </div>
            <button className="remove-file-btn" onClick={removeFile} title="Remove file">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        <button
          className="upload-btn"
          onClick={handleUpload}
          disabled={!file || status === "info"}
        >
          {status === "info" ? "Uploading..." : "Upload CSV"}
        </button>

        {message && (
          <div className={`status-message ${status}`}>
            {status === "success" && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
            {status === "error" && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            )}
            {status === "info" && (
              <svg className="spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                <line x1="12" y1="2" x2="12" y2="6" />
                <line x1="12" y1="18" x2="12" y2="22" />
                <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
                <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
                <line x1="2" y1="12" x2="6" y2="12" />
                <line x1="18" y1="12" x2="22" y2="12" />
                <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
                <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
              </svg>
            )}
            <span>{message}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default Mainpage;