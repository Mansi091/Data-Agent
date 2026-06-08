import os
import pandas as pd
from fastapi import HTTPException, APIRouter

router = APIRouter()

@router.get('/chart-data')
def get_chart_data(filename:str, column:str):
    file_path = f"uploads/{filename}"
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404,detail="File not found")

    try:
        if filename.endswith((".xlsx",".xls")):
            df = pd.read_excel(file_path)
        else:
            df = pd.read_csv(file_path)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"error in reading file : {str(e)}")

     # Numerical columns logic
    if pd.api.types.is_numeric_dtype(df[column]):
        non_null_data = df[column].dropna()
        if len(non_null_data) == 0:
            return []
        if non_null_data.nunique() <= 1:
            single_values = non_null_data.iloc[0]
            chart_data = [{"label": str(single_values), "value": len(non_null_data)}]
        else:
            is_integer_col = pd.api.types.is_integer_dtype(non_null_data) or (non_null_data % 1 == 0).all()
            counts = non_null_data.value_counts(bins=10, sort=False)
            chart_data = []
            for interval, count in counts.items():
                if is_integer_col:
                    label = f"{int(round(interval.left))} - {int(round(interval.right))}"
                else:
                    label = f"{round(interval.left, 2)} - {round(interval.right, 2)}"
                chart_data.append({
                    "label": label,
                    "value": int(count)
                })
    else:
        # Categorical columns logic
        counts = df[column].dropna().value_counts()
        top_10 = counts.head(10)
        chart_data = []
        for label, count in top_10.items():
            chart_data.append({
                "label": str(label),
                "value": int(count)
            })
        if len(counts) > 10:
            other_count = int(counts.iloc[10:].sum())
            chart_data.append({
                "label": "Other",
                "value": other_count
            })
            
    return chart_data   