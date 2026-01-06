import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  name: 'Alok Kumrawat',
  email: 'akitheraskal@gmail.com',
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {},
});

export default userSlice.reducer;
