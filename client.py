import socket
import os
import json

def send_file(filename, server_ip, server_port):
    file_size = os.path.getsize(filename)
    file_name = os.path.basename(filename)
    
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.connect((server_ip, server_port))
        s.send(str(file_size).encode())
        s.recv(1024)
        s.send(file_name.encode())
        s.recv(1024)

        with open(filename, 'rb') as f:
            while (data := f.read(1024)):
                s.sendall(data)
        print(f"Sent {file_name}")

def main():
    parameters_path = r'C:\Users\pc 1\OneDrive\Documents\VAJRA website-main\job\parameters.json'
    files_path = r'C:\Users\pc 1\OneDrive\Documents\VAJRA website-main\job'
    server_ip = '10.3.31.102'
    server_port = 12345

    with open(parameters_path, 'r') as f:
        parameters = json.load(f)

    job_id = parameters['id']
    py_file = os.path.join(files_path, f"{job_id}.py")
    pth_file = os.path.join(files_path, f"{job_id}.pth")

    # Send parameters.json
    send_file(parameters_path, server_ip, server_port)
    # Send .py file
    send_file(py_file, server_ip, server_port)
    # Send .pth file
    send_file(pth_file, server_ip, server_port)

if __name__ == "__main__":
    main()
