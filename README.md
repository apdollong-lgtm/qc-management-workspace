# QC Management Workspace

ระบบ QC ภาษาไทยบน Google Apps Script และ Google Sheets รุ่น 1.1.0

## ติดตั้งในบัญชีของผู้ซื้อ

1. สร้าง Google Sheet เปล่าในบัญชีขององค์กร แล้วเลือก Extensions → Apps Script
2. คัดลอก `Code.js` ลงไฟล์ `Code.gs` และสร้างไฟล์ HTML ชื่อ `Index` แล้วคัดลอก `Index.html`
3. ใน Project Settings ตั้ง Time zone เป็น Asia/Bangkok และเปิดแสดง appsscript.json จากนั้นคัดลอก manifest ที่แนบมา
4. เลือกฟังก์ชัน `setup` แล้ว Run และอนุญาตบริการ Google ที่ระบบใช้ ฟังก์ชันนี้ผูก Spreadsheet ID ให้ web app และงานตั้งเวลาโดยอัตโนมัติ
5. Deploy → New deployment → Web app เลือก Execute as Me และ Who has access: Only myself สำหรับรุ่นเจ้าของบัญชีเดียว แล้วเปิด URL ที่ลงท้าย /exec
6. บันทึกข้อมูลทดสอบหนึ่งรายการ ตรวจว่าพบในชีต Inspections และโหลดเว็บใหม่แล้วข้อมูลยังอยู่ ทดสอบ Hold → Pass และ CAPA Open → In progress → Closed
7. ข้อมูลตัวอย่างเป็นทางเลือก: Run `seedDemoData` เฉพาะ Sheet ทดสอบ ห้ามใช้กับข้อมูลจริง
8. ตั้งอีเมลแจ้งเตือนใน Automation และเลือกติดตั้งงานอัตโนมัติ เวลา trigger ของ Google เป็นช่วงเวลา ไม่รับประกันตรงนาที

## ขอบเขตสินค้า

- Incoming, In-process และ Final Inspection, เลข Lot อัตโนมัติ, ค้นหา, Dashboard, CAPA, ข้อมูลหลัก และ CSV
- ติดตั้งแยกบัญชี/ฐานข้อมูลของผู้ซื้อหนึ่งชุด ไม่ใช่บริการ SaaS รวมลูกค้าหลายองค์กร
- รุ่นนี้ใช้ผู้ดูแลเจ้าของบัญชี ไม่มีสิทธิ์แยกผู้ตรวจ/ผู้อนุมัติ ชื่อผู้ตรวจเป็นข้อมูลที่เลือกในฟอร์ม
- เปิด Index.html โดยตรงเป็นเดโมในหน่วยความจำ ข้อมูลเดโมไม่ถูกบันทึกลง Google Sheets
- การสรุปพื้นฐานใช้งานได้โดยไม่ใช้ API การสรุป Claude, Teams และอีเมลต้องตั้งค่าของผู้ซื้อเอง และอาจมีค่าบริการ/โควตาเพิ่มเติม
- หากเปิดใช้ Claude ระบบส่งข้อมูลสรุป QC ไป Anthropic; Teams ส่งข้อความไป webhook ที่ตั้งไว้
- Google Sheets และ Apps Script มีโควตา ไม่ออกแบบสำหรับการตรวจจำนวนมากแบบฐานข้อมูลธุรกรรม
- ก่อนเปลี่ยนรุ่นให้สำเนา Spreadsheet เก็บไว้ พร้อมเก็บ source รุ่นก่อนหน้า การส่งออก CSV เป็นข้อมูลรายการตรวจ ไม่ใช่ backup ครบทุกชีต

## อัปเดต

แก้โค้ดใน Apps Script แล้ว Deploy → Manage deployments → Edit → New version → Deploy เพื่อรักษา URL เดิม
ผู้ซื้อที่ติดตั้งสำเนาเองต้องเลือกอัปเดตเอง การ push ของผู้ขายไม่แก้ Script ของผู้ซื้อโดยอัตโนมัติ

สำหรับผู้ขาย: `npm test` ตรวจ regression; `video/` คือต้นฉบับวิดีโอ Remotion แนวนอน
workflow catalog-sync ทำงานเมื่อ push main และเผยแพร่ package/metadata ไป FactoryStudio ผ่าน GitHub OIDC เฉพาะ repository นี้

## ตรวจรับก่อนใช้ข้อมูลจริง

ทดสอบ setup บน Sheet ใหม่, บันทึกและอ่านกลับ, กรองเดือน/ไลน์/สินค้า, เปลี่ยนผลตรวจ, CAPA, ส่งออก CSV ภาษาไทย, สำรอง Sheet, แจ้งเตือนด้วยปลายทางทดสอบ และทดสอบว่าบัญชีอื่นเข้าไม่ได้
ไม่ใช้แทนการตรวจรับรองคุณภาพหรือข้อกำหนดเฉพาะของโรงงาน
