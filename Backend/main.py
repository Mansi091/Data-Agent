import os
import time
import pandas as pd
from fastapi import FastAPI, UploadFile, HTTPException, File
from fastapi.middleware.cors import CORSMiddleware
from routers.charts import router as charts_router
from routers.cleaning_data import router as cleaning_router
from routers.chatboxx import router as chatboxx_router


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(charts_router)
app.include_router(cleaning_router)
app.include_router(chatboxx_router)

os.makedirs("uploads", exist_ok=True)

@app.get('/')
def check_status():
    return {"status": "connected"}

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    if not file.filename.endswith((".csv", ".xls", ".xlsx")):
        raise HTTPException(status_code=400, detail="Invalid file type, please upload correct file (csv, xls, xlsx).")
    
    name, ext = os.path.splitext(file.filename)
    unique_filename = f"{name}_{int(time.time())}{ext}"
    file_path = f"uploads/{unique_filename}"
   
    contents = await file.read()

    with open(file_path, "wb") as buffer:
        buffer.write(contents)
    
    await file.close()

    try:
        df = pd.read_csv(file_path)

        if df.empty:
            raise HTTPException(status_code=400, detail="The file is empty")

        total_rows = len(df)
        total_cols = df.shape[1]
        data_types = df.dtypes.astype(str).to_dict()
        column_names = df.columns.tolist()
        
        numerical_colums = df.select_dtypes(include=["number"]).columns.tolist()
        categorical_cols = df.select_dtypes(include=["object"]).columns.tolist()

        duplicate_rows = int(df.duplicated().sum())
        memory_usage = round(df.memory_usage(deep=True).sum() / 1024, 2)
        statistics = df.describe().to_dict()
        preview = df.head(5).to_dict(orient="records")

        
        # DATA QUALITY & HEALTH CHECKS
      
        health_check = {}
        for col in df.columns:
            empty_count = int(df[col].isnull().sum())
            missing_pct = round((empty_count / total_rows) * 100, 2)
            unique_count = int(df[col].nunique())
            
            # 1. Cardinality classification
            if unique_count == 1:
                category_type = "Constant (Single Value)"
            elif unique_count == 2:
                category_type = "Binary (Yes/No style)"
            elif unique_count < 15:
                category_type = "Low Cardinality (Category)"
            elif unique_count == total_rows:
                category_type = "Unique ID"
            else:
                category_type = "High Cardinality"

            # 2. Outlier Detection 
            outliers_info = None
            if col in numerical_colums and unique_count > 1:
                q1 = df[col].quantile(0.25)
                q3 = df[col].quantile(0.75)
                iqr = q3 - q1
                lower_bound = q1 - 1.5 * iqr
                upper_bound = q3 + 1.5 * iqr
                
                num_outliers = int(((df[col] < lower_bound) | (df[col] > upper_bound)).sum())
                outliers_info = {
                    "outlier_count": num_outliers,
                    "percentage": round((num_outliers / total_rows) * 100, 2)
                }

            health_check[col] = {
                "missing": {
                    "empty_count": empty_count,
                    "percentage": missing_pct,
                    "is_mostly_empty": missing_pct > 50.0
                },
                "cardinality": {
                    "unique_count": unique_count,
                    "category_type": category_type
                },
                "outliers": outliers_info
            }

        return {
            "message": "File uploaded and analyzed successfully!",
            "filename": unique_filename,
            "total_rows": total_rows,
            "total_cols": total_cols,
            "data_types": data_types,
            "column_names": column_names,
            "numerical_colums": numerical_colums,
            "categorical_cols": categorical_cols,
            "duplicate_rows": duplicate_rows,
            "memory_usage": memory_usage,
            "statistics": statistics,
            "preview": preview,
            "health_check": health_check 
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")







        


