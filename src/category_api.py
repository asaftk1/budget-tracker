from flask import Flask, request, jsonify
import joblib

app = Flask(__name__)

# טען את המודל המאומן
model = joblib.load("category_classifier_model.joblib")

@app.route("/predict-category", methods=["POST"])
def predict_category():
    data = request.get_json()
    business_name = data.get("business_name")

    if not business_name:
        return jsonify({"error": "Missing business_name"}), 400

    prediction = model.predict([business_name])[0]
    return jsonify({"category": prediction})

if __name__ == "__main__":
    app.run(port=5000)
