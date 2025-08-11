
import firebase_admin
from firebase_admin import credentials, firestore
import requests

# טען את האישורים שלך
cred = credentials.Certificate("serviceAccount.json")
firebase_admin.initialize_app(cred)

db = firestore.client()
collection = db.collection("transactions")

docs = collection.stream()
total = 0

for doc in docs:
    data = doc.to_dict()
    raw_category = data.get("category")
    if not raw_category:
        continue

    try:
        res = requests.post("http://localhost:5000/predict-category", json={"business_name": raw_category})
        if res.status_code == 200:
            smart_category = res.json().get("category")
            if smart_category and smart_category != raw_category:
                doc.reference.update({"category": smart_category})
                total += 1
                print(f"עודכן: {raw_category} ➝ {smart_category}")
    except Exception as e:
        print("⚠️ שגיאה בבקשת קטגוריה:", e)

print(f"✨ סיימנו – עודכנו {total} מסמכים.")
