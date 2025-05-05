import supertest from 'supertest';

let api: supertest.SuperTest<supertest.Test>;

export const setApiRequest = (request: supertest.SuperTest<supertest.Test>) => {
  api = request;
};

// Helper for registering a test user
export const registerTestUser = async (userData: {
  username: string;
  email: string;
  password: string;
  name: string;
}) => {
  return api.post('/api/auth/register').send(userData);
};

// Helper for logging in a test user
export const loginTestUser = async (credentials: {
  email: string;
  password: string;
}) => {
  return api.post('/api/auth/login').send(credentials);
};

// Helper for accessing a protected route
export const accessProtectedRoute = async (token: string, route: string) => {
  return api.get(route).set('Authorization', `Bearer ${token}`);
};