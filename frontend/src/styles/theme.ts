import type { ThemeConfig } from 'antd';
import { theme as antdTheme } from 'antd';

export const darkTheme: ThemeConfig = {
  algorithm: antdTheme.darkAlgorithm,
  token: {
    colorPrimary: '#528bff',
    borderRadius: 6,
    fontFamily: "'Inter', 'SF Pro', -apple-system, sans-serif",
  },
};

export const lightTheme: ThemeConfig = {
  algorithm: antdTheme.defaultAlgorithm,
  token: {
    colorPrimary: '#1677ff',
    borderRadius: 6,
    fontFamily: "'Inter', 'SF Pro', -apple-system, sans-serif",
  },
};
