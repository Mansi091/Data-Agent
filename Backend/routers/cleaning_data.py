import os
import pandas as pd
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Dict, List


router = APIRouter()

# 2. Pydantic request 
class CleanRequest(BaseModel):
    filename: str
    drop_duplicates: bool = False
    fill_missing: Dict[str, str] = {}  # { "age": "mean", "gender": "mode" }
    remove_outliers: List[str] = []   # [ "price", "quantity" ]

@router.post("/clean-data")
def clean_data(request: CleanRequest):
    file_path = f"uploads/{request.filename}"
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    try:
        # Load file
        if request.filename.endswith((".xlsx", ".xls")):
            df = pd.read_excel(file_path)
        else:
            df = pd.read_csv(file_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading file: {str(e)}")

    original_rows = len(df)

    # Remove Duplicate Rows
    if request.drop_duplicates:
        df.drop_duplicates(inplace=True)

    #Fill Missing Values
    for col, strategy in request.fill_missing.items():
        if col not in df.columns:
            continue
        
        # Don't do anything if no missing values exist
        if df[col].isnull().sum() == 0:
            continue

        if strategy == "mean" and pd.api.types.is_numeric_dtype(df[col]):
            df[col] = df[col].fillna(df[col].mean())
        elif strategy == "median" and pd.api.types.is_numeric_dtype(df[col]):
            df[col] = df[col].fillna(df[col].median())
        elif strategy == "mode":
            mode_val = df[col].mode()
            if not mode_val.empty:
                df[col] = df[col].fillna(mode_val[0])
        elif strategy == "constant":
            # Fill with a sensible string or a zero for numbers
            fill_val = 0 if pd.api.types.is_numeric_dtype(df[col]) else "Unknown"
            df[col] = df[col].fillna(fill_val)

    # Remove Outliers 
    for col in request.remove_outliers:
        if col not in df.columns or not pd.api.types.is_numeric_dtype(df[col]):
            continue
        
        q1 = df[col].quantile(0.25)
        q3 = df[col].quantile(0.75)
        iqr = q3 - q1
        lower_bound = q1 - 1.5 * iqr
        upper_bound = q3 + 1.5 * iqr
        
        df = df[(df[col] >= lower_bound) & (df[col] <= upper_bound)]

    cleaned_filename = f"cleaned_{request.filename}"
    cleaned_file_path = f"uploads/{cleaned_filename}"
    
    try:
        if request.filename.endswith((".xlsx", ".xls")):
            df.to_excel(cleaned_file_path, index=False)
        else:
            df.to_csv(cleaned_file_path, index=False)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving cleaned file: {str(e)}")

    return {
        "message": "File cleaned successfully!",
        "filename": cleaned_filename,
        "original_rows": original_rows,
        "cleaned_rows": len(df)
    }

@router.get("/download")
def download_file(filename: str):
    file_path = f"uploads/{filename}"
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type='application/octet-stream'
    )
