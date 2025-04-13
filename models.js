// tạo instance
const { Sequelize, DataTypes } = require("sequelize");

// Kết nối SQLite
const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: "./db/app.db",
  logging: false, // Tắt SQL logging console của Sequelize
});

// Định nghĩa model tương đương bảng `data`
const Data = sequelize.define(
  "Data", // Model tên là "Data"
  {
    keyID: {
      type: DataTypes.STRING,
      primaryKey: true,
    },
    value: {
      type: DataTypes.TEXT,
    },
  },
  {
    tableName: "data", // lấy bảng tên "data" trong database
    timestamps: false, // không auto tạo thêm 2 cột createAt & updateAt
  }
);

// Hàm ghi dữ liệu (insert hoặc update)
async function write(key, value) {
  await Data.upsert({ keyID: key, value }); // upsert = "update" + "insert"
} // nếu chưa có key thì tạo mới, nếu có rồi thì update

// Hàm đọc dữ liệu
async function view(key) {
  const record = await Data.findByPk(key);
  return record ? record.value : null;
}

// Đảm bảo bảng đã được sync (chỉ chạy 1 lần khi khởi động)
async function init() {
  await sequelize.sync();
}

// export hàm
module.exports = {
  write,
  view,
  init,
};
