/**
 * Gets an environment variable and throws an error if it's not defined
 * @param key - The environment variable key
 * @returns The environment variable value
 * @throws Error if the environment variable is not defined and no default value is provided
 */
export const getEnvOrThrow = (key: string): string => {
  const value = process.env[key];

  if (value === undefined) {
    throw new Error(`Environment variable '${key}' is not defined`);
  }

  return value;
};
