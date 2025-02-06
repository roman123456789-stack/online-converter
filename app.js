const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs-extra');
const path = require('path');
const app = express();

const PORT = 3000;
const HOST = "http://localhost:3000";

app.use(express.static(path.join(__dirname, "public")));

const upload = multer({
    storage: multer.diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        cb(null, Math.floor(Math.random() * 99999)+ file.originalname + path.extname(file.originalname));
      },
    }),
    limits: { fileSize: 2 * 1024 * 1024 * 1024 },
    fileFilter: checkFileType,
});

function checkFileType(req, file, cb) {
  if (!file || !file.originalname) {
      return cb(new Error('Файл не выбран или имеет некорректный формат.'));
  }

  const filetypes = /\.mov$/i;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

  if (!extname) {
      return cb(new Error('Могут быть загружены только файлы .mov!'));
  }

  cb(null, true);
}
app.get("/", (req, res)=>{
    res.sendFile("index.html");
});
app.post('/upload', upload.single('video'), async (req, res) => {
    try {
      console.log(req.file);
      if (!req.file) {
        return res.status(400).json({ error: 'Файл не обнаружен!' });
      }
      const inputFilePath = req.file.path;
      const outputFileName = path.basename(req.file.filename, path.extname(req.file.originalname)) + '.mp4';
      const outputFilePath = path.join(__dirname, 'uploads', outputFileName);
  
      // Конвертация ffmpeg
      await new Promise((resolve, reject) => {
        ffmpeg(inputFilePath)
          .output(outputFilePath)
          .on('end', () => {
            console.log('Конвертация завершена');
            resolve();
          })
          .on('error', (err) => {
            console.error('Ошибка конвертации:', err.message);
            reject(err);
          })
          .run();
      });
  
      // Удалить исходный файл после конвертации
      await fs.unlink(inputFilePath);
  
      // Ответ с ссылкой для скачивания
      res.json({
        message: 'Файл сконвертирован!',
        downloadUrl: `${HOST}/download/${outputFileName}`,
      });
    } catch (error) {
      console.error('Ошибка при конвертации файла', error.message);
      res.status(500).json({ error: 'Ошибки при конвертации файла' });
    }
  });
  
  // GET /download/:filename — Скачивание готового файла
  app.get('/download/:filename', async (req, res) => {
    const fileName = req.params.filename;
    const filePath = path.join(__dirname, 'uploads', fileName);
  
    if (!(await fs.pathExists(filePath))) {
      return res.status(404).json({ error: 'Файл не найден' });
    }
  
    // Отправляем файл для скачивания
    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error('Ошибка отправки файла:', err.message);
        return res.status(500).json({ error: 'Возникли ошибки при отправке файла для скачивания' });
      } 
      else {
        res.on("finish", ()=>{
          // Удаляем файл после скачивания
          fs.unlink(filePath, (unlinkErr) => {
            if (unlinkErr) {
              console.error('Error deleting file:', unlinkErr.message);
            }
          });
        })
      }
    });
  });
  
app.listen(PORT, ()=>{
    console.log(`Server started at http://localhost:${PORT}`);
});