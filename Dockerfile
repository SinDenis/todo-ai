FROM python:3.11-slim

WORKDIR /app

# Install PostgreSQL client
RUN apt-get update && apt-get install -y postgresql-client && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy entrypoint first and set permissions
COPY entrypoint.sh .
RUN chmod 755 entrypoint.sh

# Add wait-for-it script
ADD https://raw.githubusercontent.com/vishnubob/wait-for-it/master/wait-for-it.sh /usr/local/bin/wait-for-it
RUN chmod 755 /usr/local/bin/wait-for-it

# Copy rest of the application
COPY . .

CMD ["sh", "./entrypoint.sh"]