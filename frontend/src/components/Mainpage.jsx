import { useState } from "react";
import FileUploader from "./FileUploader";
import AnalysisDashboard from "./AnalysisDashboard";
import "./Mainpage.css";

function Mainpage() {
  const [summary, setSummary] = useState(null);

  const resetUploader = () => {
    setSummary(null);
  };

  if (summary) {
    return <AnalysisDashboard summary={summary} onBack={resetUploader} />;
  }

  return <FileUploader onUploadSuccess={setSummary} />;
}

export default Mainpage;