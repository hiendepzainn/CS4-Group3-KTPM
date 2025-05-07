# GROUP 3 - Software Architecture - INT3105 2 (*CS4*)
| Full Name  | Student ID |
| ------------- | ------------- |
| Dinh Xuan Hien  | 21020197  |
| Trieu Viet Hung  | 22028069  |
| Tran Minh Son  | 21020390  |

## 1.	GIỚI THIỆU CHUNG
Trên đây là một chương trình đơn giản sử dụng **express.js**, có nhiệm vụ:
- **Ghi các giá trị vào database** theo cặp key-value
- Cung cấp một trang web liên tục **cập nhật giá trị** của key để gửi về kết quả mới, được ứng dụng để cập nhật các thông số theo thời gian thực như giá vàng, nhiệt độ,…

## 2.	VẤN ĐỀ CHƯƠNG TRÌNH GỐC GẶP PHẢI
+ **HIỆU NĂNG**: Để lấy dữ liệu theo thời gian thực, hệ thống **gửi request** tới server sau **mỗi 2s**
<br> ⇒ Gây **quá tải**, đặc biệt khi nhiều người dùng. Ví dụ như nếu có 100 người dùng đồng thời thì server phải xử lý tới 3000 request/phút
+ **PHẢN HỒI**: **Giao diện** cũng **cập nhật** sau **mỗi 2s**
<br> ⇒	**Trải nghiệm** người dùng **kém** vì dữ liệu có thể chậm nhất tới 2s so với thực tế. Điều này có thể gây thiệt hại cho những ứng dụng đề cao sự cập nhật nhanh
+ **MỞ RỘNG**: dữ liệu được xử lý theo **mô hình đồng bộ trực tiếp**
<br> ⇒	không hỗ trợ xử lý bất đồng bộ hay phân tán, **khó** có thể **đáp ứng** khi khối lượng dữ liệu hoặc số lượng người dùng **tăng cao**
+ **BẢO MẬT & BẢO TRÌ**: Truy cập cơ sở dữ liệu bằng lệnh **SQL thủ công**
<br> ⇒	Dễ bị **xâm nhập**, **khó bảo trì**
+ **TIN CẬY**: **Không có** cơ chế **dự phòng / lưu trữ tạm thời**
<br> ⇒	Trường hợp server lỗi, **dữ liệu** có thể **mất**, **khó theo dõi** và **khôi phục** dữ liệu

## 3.	NÂNG CẤP HỆ THỐNG
### 3.1. Thêm lớp persistence qua ORM <br>
- Ý tưởng: <br>
  Chuyển đổi việc viết truy vấn cơ sở dữ liệu bằng SQL thủ công sang dùng ORM (Object-Relational Mapping): **Sequelize** <br> <br>
- Triển khai: <br>
  <ins>Bước 1:</ins> Tạo Sequelize và kết nối database
  ```
  const { Sequelize, DataTypes } = require("sequelize");
  const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: "./db/app.db",
  logging: false,
  });
  ```
  <ins>Bước 2:</ins> Định nghĩa model tương đương với bảng dữ liệu
  ```
  const Data = sequelize.define(
  "Data", 
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
    tableName: "data", 
    timestamps: false, 
  }
  );
  ```
  <ins>Bước 3:</ins> Thiết lập lại hàm ghi và đọc dữ liệu
  ```
  async function write(key, value) {
  await Data.upsert({ keyID: key, value });
  } 
  
  async function view(key) {
  const record = await Data.findByPk(key);
  return record ? record.value : null;
  }
  ```
### 3.2. Thay thế công nghệ gọi request <br>
- Ý tưởng: <br>
  Thay đổi cách lấy dữ liệu từ Server: từ gọi đơn thuần sau mỗi 2 giây thành sử dụng một giao thức kết nối 2 chiều giữa Client và Server: **WebSocket** <br> <br>
- Triển khai: <br>
  <ins>Bước 1:</ins> Thêm thư viện Socket.IO
  ```
  <script src="/socket.io/socket.io.js"></script>
  ```
  <ins>Bước 2:</ins> Kết nối với sever Socket.IO
  ```
            const socket = io();

            const locationPath = window.location.pathname.split("/");
            const key = locationPath[locationPath.length - 1];

            socket.emit("subscribe", key);

            socket.on("initialValue", (data) => {
                if (data.key === key) {
                    document.getElementById("value").innerText =
                        data.value || "No value";
                }
            });
  ```
  <ins>Bước 3:</ins> Thay đổi cập nhập từ mỗi 2s/lần sang theo thời gian thực
  ```
  socket.on("valueChanged", (data) => {
                if (data.key === key) {
                    document.getElementById("value").innerText = data.value;
                }
            });
  ```
  <ins>Bước 4:</ins> Quay lại giá trị đầu nếu lỗi
  ```
  async function fetchValue() {
                try {
                    const response = await fetch(`/get/${key}`);
                    if (response.ok) {
                        const data = await response.text();
                        document.getElementById("value").innerText = data;
                    } else {
                        console.error("Failed to fetch value");
                    }
                } catch (error) {
                    console.error("Error:", error);
                }
            }
  ```
  <ins>Bước 5:</ins> Kết nối Socket.IO với sever
  ```
  io.on("connection", (socket) => {
    console.log("A client connected");

    socket.on("subscribe", async (key) => {
        console.log(`Client subscribed to key: ${key}`);
        socket.join(key);
        const value = await models.view(key);
        socket.emit("initialValue", { key, value });
    });

    socket.on("disconnect", () => {
        console.log("A client disconnected");
    });
  });
  ```
### 3.3. Triển khai kiến trúc Publisher-Subscriber & message broker <br>
- Ý tưởng: <br>
  Thay thế kiến trúc RESTful của chương trình bằng kiến trúc hướng sự kiện (event-driven) <br> <br>
- Triển khai: <br>
  <ins>Bước 1:</ins> Tạo Container sử dụng docker-compose, cài đặt Kafka và các dependency liên quan
  ```
  version: '3'
  services:
    zookeeper:
      image: confluentinc/cp-zookeeper:latest
      environment:
        ZOOKEEPER_CLIENT_PORT: 2181

    kafka:
      image: confluentinc/cp-kafka:latest
      ports:
        - 9092:9092
      environment:
        KAFKA_BROKER_ID: 1
        KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
        KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
        KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
  ```
  <ins>Bước 2:</ins> Tạo producer và consumer bằng KafkaJS
  ```
  const { Kafka } = require('kafkajs');

  const kafka = new Kafka({
    clientId: 'express-kafka-app',
    brokers: ['localhost:9092']
  });

  const producer = kafka.producer();
  const consumer = kafka.consumer({ groupId: 'express-group' });

  module.exports = { kafka, producer, consumer };
  ```
  <ins>Bước 3:</ins> Đặt producer vào endpoint /set để tạo message từ dữ liệu gửi của người dùng
  ```
  app.post("/set/:key/:value", async (req, res) => {
    await producer.send({
        topic: TOPIC,
        messages: [{ key: String(req.params.key), value: String(req.params.value) }],
    });
    res.send("Message published to Kafka");
  });
  ```
  <ins>Bước 4:</ins> Đặt consumer trong start() để lấy message tự động và xử lý database
  ```
  consumer.run({
            eachMessage: async ({ message }) => {
                const key = message.key.toString();
                const value = message.value.toString();
                console.log(`Received data: ${value} to key ${key}`);

                await models.write(key, value);
                
                io.emit("valueChanged", {
                    key: key,
                    value: value,
                });
                getCPUUsage();
                getMemoryUsage();
            },
            });
  ```
## 4.	ĐÁNH GIÁ HIỆU NĂNG SAU NÂNG CẤP
- **HIỆU NĂNG** <br>
  Nhờ có Kafka và WebSocket, dữ liệu chỉ cần gửi một lần vào Kafka và được tự động phân phối đến các client đang theo dõi, thay vì gửi dữ liệu nhiều lần cho từng client. Nhờ đó, server chỉ cần duy trì dưới 50 kết nối WebSocket ổn định để phục vụ 100 client, thay vì phải xử lý khoảng 3.000 yêu cầu HTTP mỗi phút như trước đây
- **PHẢN HỒI** <br>
  WebSocket cải thiện đáng kể tính phản hồi bằng cách đẩy dữ liệu tức thời đến client thay vì chờ polling định kỳ. Nhờ đó, giao diện luôn được cập nhật kịp thời, rất phù hợp với ứng dụng thời gian thực.
- **MỞ RỘNG & BẢO TRÌ** <br>
  Việc sử dụng Kafka giúp hệ thống mở rộng linh hoạt nhờ xử lý bất đồng bộ và khả năng scale ngang với producer–consumer độc lập. Kiến trúc tách biệt frontend, backend và message queue hỗ trợ triển khai dịch vụ mới mà không ảnh hưởng phần còn lại. ORM Sequelize giúp mã nguồn rõ ràng, dễ bảo trì và mở rộng dữ liệu hiệu quả.
- **TIN CẬY** <br>
  Kafka lưu trữ toàn bộ log tin nhắn theo thứ tự thời gian, giúp theo dõi lịch sử và phát lại dữ liệu khi cần. Nhờ đó, hệ thống đảm bảo tính toàn vẹn, tin cậy và khả năng khôi phục ngay cả khi client tạm thời mất kết nối.
## 5.	MỘT VÀI ĐÁNH GIÁ THỰC NGHIỆM
Hai chương trình được so sánh hiệu năng bằng một thí nghiệm nhanh. Sử dụng Postman, ta gửi một lượng lớn truy vấn set/get tới back-end, mỗi truy vấn cách nhau 60ms (tức 3000 lần/phút) và so sánh tiêu thụ CPU và Memory của 2 bên. Kết quả cho thấy, chương trình sau khi cải tiến có sự tối ưu hơn <br>
- **Khả năng chịu tải:** <br>
  - Phiên bản đầu: CPU và Memory tăng nhanh. CPU tiêu thụ tăng lên đến 30-45%, Memory giao động trong khoảng 90-93%
    ![image](https://github.com/user-attachments/assets/401d38ec-745f-487b-bcd0-670c92464df9)

  -	Phiên bản thứ hai : CPU và Memory ổn định hơn. CPU dao động trong 27-30%, Memory dao động trong khoảng 88-90% <br>
  ![image](https://github.com/user-attachments/assets/9c2cdf35-459f-436d-838f-92d1e62dae3a)

- **Phản ứng với update lớn:** <br>
  - Phiên bản đầu: Memory tăng mạnh ban đầu, nhưng trở nên ổn định về sau. Memory tăng lên đến 90-93%, rồi giảm xuống, giao động trong khoảng 86-88%. CPU duy trì ở mức 30-40%
    ![image](https://github.com/user-attachments/assets/265ea71b-155f-4cf3-8841-06a4f9074d29)

  - Phiên bản sau: CPU và Memory giữ ổn định trong suốt quá trình. CPU giao động trong khoảng 86-88% và Memory giao động trong khoảng 27-30%
    ![image](https://github.com/user-attachments/assets/33e9e568-cc55-456d-949b-52b39f6fc9e6)

