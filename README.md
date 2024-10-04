## Webserver deployment steps

1. Deploy an Ubuntu EC2 instance and connect with your key
2. Update the system:
   `sudo apt update && sudo apt upgrade -y`
3. Install node and npm:

```
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs
```

4. Install Nginx:
   `sudo apt install nginx -y`
5. Start Nginx and enable it to run on boot:

```
sudo systemctl start nginx
sudo systemctl enable nginx
```

6. Configure the firewall to allow HTTP and HTTPS traffic:
   `sudo ufw allow 'Nginx Full'`

7. Transfer the frontend to the `/var/www/html/` and the backend to `/var/www/api/`

8. Install the backend (`npm install`) and create the .env file

9. Set the `BACKEND_URL` in the frontend's script.js to the public IP of the instance

10. Install PM2 to manage the node application
    `sudo npm install -g pm2`

11. Start the node application:
    `pm2 start app.js`

12. Edit the Nginx configuration:
    `sudo nano /etc/nginx/sites-available/default`

13. Replace teh contents with:

```
server {
    listen 80;
    server_name your_domain.com;

    location / {
        root /var/www/html;  # Assuming your frontend files are here
        index index.html index.htm;
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

14. Restart Nginx:
    `sudo systemctl restart nginx`

15. Set permissions for the folder:

```
sudo chown -R ubuntu:www-data /var/www/api/
sudo chmod -R 755 /var/www/api/
```

Hardcoded API key: 3b53cb7a-cf27-4fd3-80c3-6ec7dd5c8275

## Variables to set

### Backend

Set the environmental variables (either in the environment or with a .env file):

- OPENAI_API_KEY=<YOUR API KEY HERE>
- PORT=<PORT NUMBER> (Optional, default is 3000)

### Frontend

- Set the BACKEND_URL in the top of the script.js file
