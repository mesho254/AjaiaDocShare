FROM node:24-alpine

WORKDIR /app

COPY package.json ./
COPY Backend/package*.json ./Backend/
COPY Frontend/package*.json ./Frontend/

RUN cd Frontend && npm install --include=dev
RUN cd Backend && npm install --include=dev

COPY Frontend ./Frontend
COPY Backend ./Backend

RUN cd Frontend && npm run build
RUN cd Backend && npm run build

EXPOSE 4000
ENV PORT=4000

CMD ["npm", "run", "start", "--prefix", "Backend"]
