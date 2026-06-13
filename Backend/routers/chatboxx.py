import os
import ast
import json
import pandas as pd
import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
router = APIRouter()
load_dotenv()

class ChatRequest(BaseModel):
    filename: str
    question: str
def get_dataset_context(df: pd.DataFrame) -> dict:
    return {
        "shape": df.shape,
        "columns": df.columns.tolist(),
        "dtypes": df.dtypes.astype(str).to_dict(),
        "sample_rows": df.head(5).to_dict(orient="records"),
        "missing_values": df.isnull().sum().to_dict(),
    }
def generate_pandas_code(question: str, context_str: str) -> str:
    llm = ChatGroq(
        model="llama-3.3-70b-versatile",
        temperature=0.0,
    )
    prompt = ChatPromptTemplate.from_messages([
        (
            "system",
            """
You are a Pandas code generator.
Your task:
Generate exactly ONE Python Pandas expression to answer the user's question.
Rules:
- Use only the dataframe variable `df`.
- Return ONLY the executable code string.
- Do NOT wrap code in markdown blocks like ```python.
- Do NOT use print() or import.
- Do NOT use loops or file handling.
- Do NOT use exec or eval.
- Do NOT explain anything or add comments.
Examples:
Question: What is the average age?
Answer: df["age"].mean()
Question: How many rows are there?
Answer: len(df)
"""
        ),
        (
            "human",
            "Dataset Context:\n{context}\n\n User Question:\n{question}\n\nGenerated Pandas code:"
        )
    ])
    chain = prompt | llm | StrOutputParser()
    code = chain.invoke({"context": context_str, "question": question})
    
    return code.strip().replace("```python", "").replace("```", "").strip()


def validate_code_with_ast(code: str) -> bool:
    blocked_words = [
        "import", "open", "exec", "eval",
        "os", "sys", "requests", "locals", "globals",
        "read", "write", "remove", "delete", "to_csv", "to_excel"
    ]
    for word in blocked_words:
        if word in code:
            return False
    try:
        ast.parse(code)
        return True
    except Exception:
        return False



def generate_final_answer(question: str, code: str, result_str: str) -> str:
    llm = ChatGroq(
        model="llama-3.3-70b-versatile",
        temperature=0.2,
    )
    prompt = ChatPromptTemplate.from_messages([
        (
            "system",
            "You are a helpful data analyst. Translate the execution result of the Pandas expression into a friendly, clear, natural language answer for the user."
        ),
        (
            "human",
            "User question: {question}\nExecuted Pandas code: {code}\nResult of execution: {result}\n\nYour natural language explanation:"
        )
    ])
    chain = prompt | llm | StrOutputParser()
    return chain.invoke({"question": question, "code": code, "result": result_str})


@router.post("/chat")
async def chat(data: ChatRequest):
    file_path = f"uploads/{data.filename}"

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    try:
        if data.filename.endswith((".xlsx", ".xls")):
            df = pd.read_excel(file_path)
        else:
            df = pd.read_csv(file_path)
        context_dict = get_dataset_context(df)
        context_str = json.dumps(context_dict, indent=2)
        pandas_code = generate_pandas_code(data.question, context_str)

        
        if not validate_code_with_ast(pandas_code):
            raise ValueError(f"Generated unsafe or invalid code expression: {pandas_code}")

        allowed_builtins = {
            "len": len,
            "int": int,
            "float": float,
            "round": round,
            "str": str,
            "list": list,
            "dict": dict,
            "sum": sum,
            "min": min,
            "max": max,
            "abs": abs
        }
        local_vars = {"df": df, "pd": pd, "np": np}
        execution_result = eval(pandas_code, {"__builtins__": allowed_builtins}, local_vars)
        result_str = str(execution_result)

        
        answer = generate_final_answer(data.question, pandas_code, result_str)
        return {"answer": answer}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error processing chat: {str(e)}"
        )
