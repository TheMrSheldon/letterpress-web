const { exec } = await import('child_process')

export const load = async () => {
    const stdout = await new Promise((resolve, reject) => {
        exec(
            "ls -l",
            (err, stdout) => err ? reject(err) : resolve(stdout)
        );
    });
    console.log(stdout);

    return { stdout };
}