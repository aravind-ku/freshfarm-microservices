import os

from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import pymysql

load_dotenv()

app = Flask(__name__)
CORS(app)


def get_db_connection():
    return pymysql.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "3306")),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        database=os.getenv("DB_NAME", "freshfarm"),
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=True
    )


def execute_query(query):
    connection = get_db_connection()
    cursor = connection.cursor()

    try:
        cursor.execute(query)
        return cursor.fetchall()
    finally:
        cursor.close()
        connection.close()


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "service": "Fresh Farm Analytics Service",
        "language": "Python",
        "status": "UP"
    })


@app.route("/analytics/summary", methods=["GET"])
def summary():
    try:
        rows = execute_query("""
            SELECT
                COUNT(*) AS totalOrders,
                SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END)
                    AS paidOrders,
                SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END)
                    AS cancelledOrders,
                COALESCE(
                    SUM(
                        CASE
                            WHEN status IN ('PAID', 'DELIVERED')
                            THEN total_amount
                            ELSE 0
                        END
                    ),
                    0
                ) AS totalRevenue
            FROM orders
        """)

        result = rows[0]

        return jsonify({
            "totalOrders": result["totalOrders"],
            "paidOrders": int(result["paidOrders"] or 0),
            "cancelledOrders": int(result["cancelledOrders"] or 0),
            "totalRevenue": float(result["totalRevenue"] or 0)
        })

    except Exception as error:
        print("Analytics summary error:", error)

        return jsonify({
            "message": "Unable to fetch analytics summary"
        }), 500


@app.route("/analytics/orders-by-status", methods=["GET"])
def orders_by_status():
    try:
        return jsonify(execute_query("""
            SELECT
                status,
                COUNT(*) AS total
            FROM orders
            GROUP BY status
            ORDER BY total DESC
        """))

    except Exception as error:
        print("Orders by status error:", error)
        return jsonify({"message": "Unable to fetch analytics"}), 500


@app.route("/analytics/top-products", methods=["GET"])
def top_products():
    try:
        rows = execute_query("""
            SELECT
                milk_type AS productName,
                product_type AS productType,
                SUM(quantity) AS quantitySold,
                SUM(total_amount) AS revenue
            FROM orders
            WHERE status IN ('PAID', 'DELIVERED')
            GROUP BY milk_type, product_type
            ORDER BY quantitySold DESC
            LIMIT 10
        """)

        for row in rows:
            row["quantitySold"] = float(row["quantitySold"] or 0)
            row["revenue"] = float(row["revenue"] or 0)

        return jsonify(rows)

    except Exception as error:
        print("Top products error:", error)
        return jsonify({"message": "Unable to fetch analytics"}), 500


@app.route("/analytics/sales-by-type", methods=["GET"])
def sales_by_type():
    try:
        rows = execute_query("""
            SELECT
                product_type AS productType,
                COUNT(*) AS totalOrders,
                SUM(quantity) AS quantitySold,
                SUM(total_amount) AS revenue
            FROM orders
            WHERE status IN ('PAID', 'DELIVERED')
            GROUP BY product_type
        """)

        for row in rows:
            row["quantitySold"] = float(row["quantitySold"] or 0)
            row["revenue"] = float(row["revenue"] or 0)

        return jsonify(rows)

    except Exception as error:
        print("Sales by type error:", error)
        return jsonify({"message": "Unable to fetch analytics"}), 500


@app.route("/analytics/daily-sales", methods=["GET"])
def daily_sales():
    try:
        rows = execute_query("""
            SELECT
                DATE(created_at) AS saleDate,
                COUNT(*) AS totalOrders,
                SUM(total_amount) AS revenue
            FROM orders
            WHERE status IN ('PAID', 'DELIVERED')
            GROUP BY DATE(created_at)
            ORDER BY saleDate DESC
            LIMIT 30
        """)

        for row in rows:
            row["saleDate"] = str(row["saleDate"])
            row["revenue"] = float(row["revenue"] or 0)

        return jsonify(rows)

    except Exception as error:
        print("Daily sales error:", error)
        return jsonify({"message": "Unable to fetch analytics"}), 500


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5006"))

    print(
        f"Fresh Farm Analytics Service running on "
        f"http://localhost:{port}"
    )

    app.run(
        host="0.0.0.0",
        port=port,
        debug=False
    )