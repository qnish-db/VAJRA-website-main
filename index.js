import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { execFile } from 'child_process';

const app = express();
const port = 3000;

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "de10",
  password: "123456",
  port: 5432,
});
db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(__filename);

// GET home page
app.get("/", async (req, res) => {
  res.render("index.ejs");
});

app.post("/", async (req, res) => {
  const pid = req.body["pesu_id"];
  const pass = req.body["password"];

  try {
    const result = await db.query(
      "SELECT password FROM users WHERE pesu_id=$1",
      [pid]
    );
    if (pass === result.rows[0].password) {
      res.render("new.ejs");
    } else {
      res.render("index.ejs", { error: "wrong password" });
    }
  } catch (err) {
    console.log("error");
    res.render("index.ejs", { error: "pesu id not registered" });
  }
});

function newuser() {
  document.querySelector(".signup").classList.remove("hidden");
  document.querySelector(".login").classList.add("hidden");
}

app.get("/signin", async (req, res) => {
  res.render("signin.ejs");
});

app.post("/signin", async (req, res) => {
  const pid = req.body["pesu_id"];
  const n_pass = req.body["new_password"];
  const c_pass = req.body["confirm_password"];

  const result = await db.query(
    "SELECT pesu_id FROM users WHERE pesu_id=$1",
    [pid]
  );

  if (result.rows[0] !== undefined) {
    res.render("signin.ejs", { error: "mail already in use" });
  } else {
    const a = pid.slice(-13);
    const b = "@pesu.pes.edu";
    const c = parseInt(pid.slice(4, 8));
    if (a !== b || c > 2024) {
      res.render("signin.ejs", { error: "mail id must be a pesu mail id" });
    } else {
      if (n_pass === c_pass) {
        await db.query(
          "INSERT INTO users (pesu_id, password) VALUES ($1, $2);",
          [pid, n_pass]
        );
        res.render("new.ejs");
      } else {
        res.render("signin.ejs", { error: "new password and confirmed password don't match" });
      }
    }
  }
});

app.get("/new", async (req, res) => {
  res.render("new.ejs");
});

app.get("/execute", (req, res) => {
  res.render("execute.ejs", { errorMessage: null });
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(dirname, 'job'));
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname);
  }
});

const upload = multer({ storage: storage });

const getNextId = async () => {
  try {
    const result = await db.query('SELECT counter_value FROM counter WHERE name = $1', ['counter']);
    let counterValue = result.rows[0].counter_value;
    const nextId = counterValue + 1;
    await db.query('UPDATE counter SET counter_value = $1 WHERE name = $2', [nextId, 'counter']);
    return `job${nextId}`;
  } catch (error) {
    console.error('Error getting next ID:', error);
    throw error;
  }
};

const clientScriptPath = 'C:\\Users\\pc 1\\OneDrive\\Documents\\VAJRA website-main\\client.py';

import { spawn } from 'child_process'

// Run a Python script and return output
// Use fileURLToPath to get the current directory for ES Modules
const __dirname = path.dirname(__filename);

// Run a Python script and return output
function runPythonScript(scriptPath, args) {
  const pyProg = spawn('python', [scriptPath].concat(args));

  let data = '';
  pyProg.stdout.on('data', (stdout) => {
    data += stdout.toString();
  });

  pyProg.stderr.on('data', (stderr) => {
    console.log(`stderr: ${stderr}`);
  });

  pyProg.on('close', (code) => {
    console.log(`child process exited with code ${code}`);
    console.log(data);
  });
}

app.post("/execute", upload.fields([{ name: 'model-file' }, { name: 'python-file' }]), async (req, res) => {
  const { layers, batch_size } = req.body;

  console.log("Received execute request with layers:", layers, "and batch_size:", batch_size);

  if (!layers || !batch_size || !req.files['model-file'] || req.files['model-file'].length === 0 || !req.files['python-file'] || req.files['python-file'].length === 0) {
    return res.render("execute.ejs", { errorMessage: 'All fields are required.' });
  }

  const layerDimensions = [];
  for (let i = 1; i <= layers; i++) {
    const dimension = parseInt(req.body[`layer_${i}`]);
    if (dimension && Number.isInteger(dimension)) {
      layerDimensions.push(dimension);
    } else {
      return res.render("execute.ejs", { errorMessage: 'Each layer dimension must be an integer.' });
    }
  }

  const parametersPath = path.join(__dirname, 'job', 'parameters.json');

  fs.readFile(parametersPath, 'utf8', async (err, data) => {
    if (err) {
      console.error('Error reading parameters.json:', err);
      return res.status(500).render("execute.ejs", { errorMessage: 'Internal Server Error' });
    }

    let parameters = {};

    try {
      parameters = JSON.parse(data);
    } catch (parseErr) {
      console.error('Error parsing parameters.json:', parseErr);
      return res.status(500).render("execute.ejs", { errorMessage: 'Internal Server Error' });
    }

    const nextId = await getNextId();

    parameters.id = nextId;
    parameters.layers = parseInt(layers);
    parameters.batch_size = parseInt(batch_size);
    parameters.layer_dimensions = layerDimensions;

    const modelFile = req.files['model-file'][0];
    const pythonFile = req.files['python-file'][0];

    const modelFilePath = path.join(__dirname, 'job', `${nextId}.pth`);
    const pythonFilePath = path.join(__dirname, 'job', `${nextId}.py`);

    console.log("Renaming model and python files...");

    fs.rename(modelFile.path, modelFilePath, (err) => {
      if (err) {
        console.error('Error renaming model file:', err);
        return res.status(500).render("execute.ejs", { errorMessage: 'Internal Server Error' });
      }

      fs.rename(pythonFile.path, pythonFilePath, (err) => {
        if (err) {
          console.error('Error renaming python file:', err);
          return res.status(500).render("execute.ejs", { errorMessage: 'Internal Server Error' });
        }

        fs.writeFile(parametersPath, JSON.stringify(parameters, null, 2), 'utf8', (writeErr) => {
          if (writeErr) {
            console.error('Error writing to parameters.json:', writeErr);
            return res.status(500).render("execute.ejs", { errorMessage: 'Internal Server Error' });
          }

          // Execute the client.py script using runPythonScript
          const clientScriptPath = path.join(__dirname, 'client.py');
          console.log("Executing client.py script at path:", clientScriptPath);
          runPythonScript(clientScriptPath, []);

          res.render("result.ejs");
        });
      });
    });
  });
});


const resultFilePath = path.join(dirname, 'result.txt');

app.get('/check-result', (req, res) => {
  fs.readFile(resultFilePath, 'utf8', (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.json({ resultReady: false });
      } else {
        console.error(err);
        res.status(500).send('Server error');
      }
    } else {
      const resultLines = data.trim().split('\n').map(line => parseFloat(line.split(',')[0]));
      res.json({ resultReady: true, result: resultLines });
    }
  });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
