from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, date

app = Flask(__name__)

# 使用 SQLite 當作資料庫，檔案名稱為 tasks.db
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///tasks.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)


class Task(db.Model):
    """
    tasks 資料表：
    - id: 主鍵
    - title: 作業名稱（必填）
    - course: 課程名稱
    - due_date: 截止日期（date）
    - priority: 優先程度 high / medium / low
    - note: 備註
    - completed: 是否完成（布林值）
    - created_at / updated_at: 建立與更新時間
    """
    __tablename__ = "tasks"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    course = db.Column(db.String(200))
    due_date = db.Column(db.Date)
    priority = db.Column(db.String(10), default="medium")  # high / medium / low
    note = db.Column(db.Text)
    completed = db.Column(db.Boolean, default=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    def to_dict(self):
        """把資料表轉成可以丟給前端的 JSON 格式"""
        return {
            "id": self.id,
            "title": self.title,
            "course": self.course,
            "due_date": self.due_date.isoformat() if self.due_date else None,
            "priority": self.priority,
            "note": self.note,
            "completed": self.completed,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


def create_tables():
    """啟動時建立資料表（如果尚未存在）"""
    db.create_all()



# -------------------- 前端頁面 --------------------


@app.route("/")
def index():
    """回傳首頁模板，前端 JS 會再去打 /api/tasks"""
    return render_template("index.html")


# -------------------- RESTful API --------------------


@app.route("/api/tasks", methods=["GET"])
def get_tasks():
    """
    GET /api/tasks
    取得全部作業（目前先全部丟給前端，排序 / 篩選在前端處理）
    """
    tasks = Task.query.order_by(Task.created_at.desc()).all()
    return jsonify([t.to_dict() for t in tasks])


@app.route("/api/tasks", methods=["POST"])
def create_task():
    """
    POST /api/tasks
    新增作業
    JSON body 例如：
    {
      "title": "CH7 習題",
      "course": "雲端科技導論",
      "due_date": "2025-12-31",
      "priority": "high",
      "note": "要交PDF",
      "completed": false
    }
    """
    data = request.get_json()

    if not data:
        return jsonify({"error": "缺少 JSON body"}), 400

    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "作業名稱（title）為必填"}), 400

    # 處理截止日期字串 → date 物件
    due_date_str = data.get("due_date")
    due_date_value = None
    if due_date_str:
        try:
            year, month, day = map(int, due_date_str.split("-"))
            due_date_value = date(year, month, day)
        except ValueError:
            return jsonify({"error": "截止日期格式錯誤，請使用 YYYY-MM-DD"}), 400

    task = Task(
        title=title,
        course=data.get("course"),
        due_date=due_date_value,
        priority=data.get("priority", "medium"),
        note=data.get("note"),
        completed=bool(data.get("completed", False)),
    )

    db.session.add(task)
    db.session.commit()

    return jsonify(task.to_dict()), 201


@app.route("/api/tasks/<int:task_id>", methods=["PUT"])
def update_task(task_id):
    """
    PUT /api/tasks/<id>
    更新作業
    body 裡面有給的欄位才會更新（可部分更新）
    """
    task = Task.query.get_or_404(task_id)
    data = request.get_json() or {}

    if "title" in data:
        new_title = (data.get("title") or "").strip()
        if not new_title:
            return jsonify({"error": "作業名稱不能為空白"}), 400
        task.title = new_title

    if "course" in data:
        task.course = data.get("course")

    if "due_date" in data:
        due_date_str = data.get("due_date")
        if due_date_str:
            try:
                year, month, day = map(int, due_date_str.split("-"))
                task.due_date = date(year, month, day)
            except ValueError:
                return jsonify({"error": "截止日期格式錯誤，請使用 YYYY-MM-DD"}), 400
        else:
            # 如果前端傳空字串，代表清掉截止日
            task.due_date = None

    if "priority" in data:
        task.priority = data.get("priority") or "medium"

    if "note" in data:
        task.note = data.get("note")

    if "completed" in data:
        task.completed = bool(data.get("completed"))

    db.session.commit()
    return jsonify(task.to_dict())


@app.route("/api/tasks/<int:task_id>", methods=["DELETE"])
def delete_task(task_id):
    """
    DELETE /api/tasks/<id>
    刪除作業
    """
    task = Task.query.get_or_404(task_id)
    db.session.delete(task)
    db.session.commit()
    return jsonify({"message": "Task deleted"})


print(">>> 檔案 app.py 已經被 Python 執行了")

if __name__ == "__main__":
    print(">>> 進到 __main__，準備啟動 Flask，先建立資料表...")
    # 需要在 app context 裡呼叫 create_all()
    with app.app_context():
        create_tables()

    # 本機開發用，Render 上會用 gunicorn app:app
    app.run(debug=True)
