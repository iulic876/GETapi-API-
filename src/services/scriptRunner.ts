import ivm from 'isolated-vm';

export interface ScriptRunResult {
  variables: Record<string, any>;
  error?: string;
}

export const runScript = async (
  script: string,
  variables: Record<string, any>
): Promise<ScriptRunResult> => {
  if (!script) {
    return { variables };
  }

  const isolate = new ivm.Isolate({ memoryLimit: 128 });
  const context = await isolate.createContext();
  const jail = context.global;

  // Set a global 'pm' object similar to Postman
  await jail.set('pm', new ivm.Reference(variables));

  try {
    const code = `
      // The user script will run here
      ${script}
      // Return the modified 'pm' object
      return pm;
    `;
    
    const result = await context.eval(code, { timeout: 1000 });
    const newVariables = await result.copy();
    return { variables: newVariables };
  } catch (err: any) {
    return {
      variables,
      error: err.message,
    };
  } finally {
    if (!isolate.isDisposed) {
      isolate.dispose();
    }
  }
}; 