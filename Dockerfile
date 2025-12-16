# Use the official Node.js image
FROM node:18

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Run Knex migrations
#RUN npx knex migrate:latest

# Expose the application port
EXPOSE 8888

# Command to run the application
# Use npm start so it follows package.json ("node src/server.js")
CMD ["npm", "start"]