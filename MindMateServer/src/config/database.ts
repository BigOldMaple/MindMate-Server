// config/database.ts
export const DB_CONFIG = {
    development: {
      uri: 'mongodb://localhost:27017/mindmate',
      options: {
        maxPoolSize: 10,
        minPoolSize: 2,
        retryWrites: true,
      }
    },
    production: {
      uri: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/mindmate',
      options: {
        maxPoolSize: 50,
        minPoolSize: 5,
        retryWrites: true,
        ssl: true,
      }
    }
  } as const;
  
  export type Environment = keyof typeof DB_CONFIG;