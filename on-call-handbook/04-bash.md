# Chapter 4 — Bash Scripting

> **Why this chapter matters:** Nobody expects a junior engineer to write elegant 500-line programs in Bash. But *every* on-call and support role expects you to automate small, repetitive tasks — check if a service is up, clean old logs, back up a folder, alert when disk is full. Interviewers ask Bash to see if you can turn a manual chore into a script. This chapter gives you the building blocks and 10 real scripts you could genuinely use on the job.

> 🧠 **The one thing to remember:** A Bash script is just **the same commands you'd type at the terminal, saved in a file and run top to bottom.** If you know the commands from Chapter 3, you're 80% there.

---

## 4.1 Your first script — the anatomy ★★★★☆

```bash
#!/bin/bash
# This line above is the "shebang" — it tells the OS to run this with bash.

echo "Hello, on-call world!"
```

**To run it:**
```bash
chmod +x hello.sh    # make it executable (remember chmod from Ch.3!)
./hello.sh           # run it
```

**The shebang `#!/bin/bash`** must be the first line. It tells the system which interpreter to use. Without it, the OS doesn't know the file is a Bash script.

> 💬 **Interviewers usually ask:** "What's the first line of a shell script for?"
> ✅ **Answer:** "The shebang, `#!/bin/bash`. It tells the operating system which interpreter should run the script — in this case Bash. Without it, the system doesn't know how to execute the file."

> 🧠 **Memory trick:** Shebang = **She-Bang!** (`#!`) — the bang that *launches* the right interpreter.

---

## 4.2 Variables ★★★★☆

```bash
#!/bin/bash
name="Alice"           # NO spaces around = (this is the #1 beginner error)
count=5

echo "Hello $name"     # use $ to read a variable
echo "Count is ${count}"   # ${} braces when you need clear boundaries

# Command substitution — capture a command's output into a variable:
today=$(date +%Y-%m-%d)
files=$(ls | wc -l)
echo "Today is $today, there are $files files here."
```

> ⚠️ **Common mistake #1 (interviewers love catching this):** Spaces around `=`. `name = "Alice"` is **wrong** — Bash thinks `name` is a command. It must be `name="Alice"` with no spaces.

> ⚠️ **Common mistake #2:** Forgetting the `$` when *reading* a variable. You assign with `name=...` but read with `$name`.

> 🧠 **Memory trick:** **Assign without `$`, read with `$`.** And **no spaces around `=`, ever.** `$(...)` captures command output.

---

## 4.3 User input & output ★★★☆☆

```bash
#!/bin/bash
echo "What's your name?"
read name                    # read input into $name
echo "Hello, $name!"

read -p "Enter a number: " num    # -p prints the prompt inline
echo "You typed $num"

read -sp "Password: " pass         # -s hides input (silent) for secrets
echo    # newline after hidden input
```

- `echo` prints output (add `-n` to skip the trailing newline).
- `read` gets input from the user. `-p` shows a prompt, `-s` hides typing (for passwords).

> 🧠 **Memory trick:** `echo` = **out**, `read` = **in**. `-p` = prompt, `-s` = secret.

---

## 4.4 Arguments ★★★★☆

Scripts take arguments from the command line — `./backup.sh /home/data` — accessed with special variables. **This is high-yield because real scripts are almost always parameterized.**

```bash
#!/bin/bash
echo "Script name: $0"       # the script's own name
echo "First arg:   $1"       # first argument
echo "Second arg:  $2"       # second argument
echo "All args:    $@"       # all arguments
echo "How many:    $#"       # count of arguments
```

Running `./greet.sh Alice Bob` gives: `$1`=Alice, `$2`=Bob, `$#`=2, `$@`=Alice Bob.

**Always check arguments were provided:**
```bash
if [ $# -eq 0 ]; then
    echo "Usage: $0 <filename>"
    exit 1                    # exit with error code 1
fi
```

> 💬 **Interviewers usually ask:** "How does a shell script access command-line arguments?"
> ✅ **Answer:** "Positional parameters: `$1` is the first argument, `$2` the second, and so on. `$0` is the script name itself, `$@` is all arguments, and `$#` is the count. I always check `$#` at the top to make sure the user passed what's required, and print a usage message and `exit 1` if not."

> 🧠 **Memory trick:** **`$1 $2 $3`** = the args in order. **`$#`** = # of args (# = "number"). **`$@`** = @ll of them. **`$0`** = the script itself.

---

## 4.5 Conditions (if statements) ★★★★★

**The most important control structure. The bracket syntax and operators trip up almost everyone — study this carefully.**

```bash
#!/bin/bash
num=10

if [ $num -gt 5 ]; then
    echo "Greater than 5"
elif [ $num -eq 5 ]; then
    echo "Exactly 5"
else
    echo "Less than 5"
fi
```

**Number comparisons (memorize — these are asked):**

| Operator | Meaning | Think |
|----------|---------|-------|
| `-eq` | equal | **eq**ual |
| `-ne` | not equal | **n**ot **e**qual |
| `-gt` | greater than | **g**reater **t**han |
| `-lt` | less than | **l**ess **t**han |
| `-ge` | greater or equal | |
| `-le` | less or equal | |

**String comparisons:** use `=`, `!=` (and quote your variables):
```bash
if [ "$name" = "admin" ]; then echo "Welcome admin"; fi
if [ -z "$name" ]; then echo "Name is empty"; fi   # -z = zero length
```

**File tests (very common in ops scripts):**

| Test | True if... |
|------|-----------|
| `-f file` | file exists and is a regular file |
| `-d dir` | directory exists |
| `-e path` | path exists (file or dir) |
| `-r` / `-w` / `-x` | readable / writable / executable |
| `-z "$var"` | variable is empty |
| `-n "$var"` | variable is non-empty |

```bash
if [ -f /etc/nginx/nginx.conf ]; then
    echo "Config exists"
else
    echo "Config missing!"
fi
```

> ⚠️ **Common mistakes:** (1) Forgetting **spaces inside the brackets** — `[$num -gt 5]` fails; it must be `[ $num -gt 5 ]`. (2) Using `>` for number comparison — that's redirection! Use `-gt`. (3) Not quoting variables — `[ $name = x ]` breaks if `$name` is empty or has spaces; use `[ "$name" = x ]`.

> 💬 **Interviewers usually ask:** "How do you check if a file exists in a Bash script?"
> ✅ **Answer:** "`if [ -f /path/to/file ]; then ... fi`. The `-f` test is true when the file exists and is a regular file; `-d` checks a directory and `-e` checks either. In ops scripts I use this constantly — for example, checking a config or log file exists before acting on it."

> 🧠 **Memory trick:** **Spaces inside `[ ]` are mandatory.** Numbers use `-eq -ne -gt -lt`; strings use `= !=`. Files use `-f -d -e`.

---

## 4.6 Loops ★★★★☆

### for loop — iterate over a list
```bash
for i in 1 2 3 4 5; do
    echo "Number $i"
done

for file in *.log; do          # loop over all .log files
    echo "Processing $file"
done

for i in $(seq 1 100); do      # 1 to 100
    echo $i
done
```

### while loop — repeat while a condition holds
```bash
count=1
while [ $count -le 5 ]; do
    echo "Count: $count"
    count=$((count + 1))       # arithmetic: $(( ... ))
done
```

**Reading a file line by line (a genuinely useful pattern):**
```bash
while read line; do
    echo "Line: $line"
done < input.txt
```

> 🧠 **Memory trick:** **`for`** = "for each thing in a list." **`while`** = "keep going while true." Arithmetic goes in **`$(( ))`**.

---

## 4.7 Functions ★★★☆☆

```bash
#!/bin/bash

greet() {
    echo "Hello, $1!"          # functions use $1, $2 for THEIR arguments
}

check_service() {
    if systemctl is-active --quiet "$1"; then
        echo "$1 is running"
        return 0               # 0 = success
    else
        echo "$1 is DOWN"
        return 1               # non-zero = failure
    fi
}

greet "Alice"
check_service "nginx"
```

- Functions keep scripts organized and avoid repetition.
- They take arguments the same way scripts do: `$1`, `$2`.
- `return` gives an **exit code** (0 = success), not a value — capture actual output with `echo` + `$(...)`.

> 🧠 **Memory trick:** Functions reuse the `$1 $2` argument system. **`return 0` = success**, like the rest of Unix (0 is good, non-zero is an error).

---

## 4.8 Arrays ★★☆☆☆

```bash
servers=("web1" "web2" "web3")

echo "${servers[0]}"        # first element → web1
echo "${servers[@]}"        # all elements
echo "${#servers[@]}"       # count → 3

for s in "${servers[@]}"; do
    echo "Pinging $s"
done
```

> 🧠 **Memory trick:** Arrays echo the `$#`/`$@` idea: **`[@]` = all, `${#arr[@]}` = count.** Index starts at 0. *(Lower frequency — know the basics and move on.)*

---

## 4.9 Exit codes — the Unix success/failure convention ★★★★☆

Every command returns an **exit code**: **`0` means success, anything non-zero means failure.** Check the last command's code with `$?`. This underpins error handling in scripts and comes up in interviews.

```bash
systemctl restart nginx
if [ $? -eq 0 ]; then
    echo "Restart succeeded"
else
    echo "Restart FAILED"
fi

# Chaining with && (and) and || (or):
mkdir /backup && echo "created"      # run 2nd only if 1st succeeded
ping -c1 google.com || echo "no network"   # run 2nd only if 1st failed
```

> 💬 **Interviewers usually ask:** "How do you know if the last command succeeded?"
> ✅ **Answer:** "Check `$?` — it holds the exit code of the last command, where 0 means success and non-zero means failure. I can branch on it with an `if`, or chain commands: `cmd1 && cmd2` runs the second only if the first succeeds, and `cmd1 || cmd2` runs the second only if the first fails."

> 🧠 **Memory trick:** **0 = OK.** `$?` = "what was the result?" `&&` = and-then, `||` = or-else.

---

## 4.10 Cron jobs — scheduling scripts ★★★★☆

**Cron** runs scripts automatically on a schedule — nightly backups, hourly log cleanup, health checks. You edit your cron table with `crontab -e`.

**The five time fields:**
```
┌───── minute (0–59)
│ ┌───── hour (0–23)
│ │ ┌───── day of month (1–31)
│ │ │ ┌───── month (1–12)
│ │ │ │ ┌───── day of week (0–6, Sun=0)
│ │ │ │ │
* * * * *   command_to_run
```

**Real examples:**
```bash
0 2 * * *      /home/scripts/backup.sh       # every day at 2:00 AM
*/15 * * * *   /home/scripts/health.sh        # every 15 minutes
0 0 * * 0      /home/scripts/weekly.sh        # midnight every Sunday
30 3 1 * *     /home/scripts/monthly.sh       # 3:30 AM on the 1st
```

> 🧠 **Memory trick:** **"Minute, Hour, Day-of-month, Month, Day-of-week"** — remember the order **M H Dom M Dow**. A `*` means "every." `*/15` means "every 15." Use [crontab.guru](https://crontab.guru) to check schedules.

> 💬 **Interviewers usually ask:** "How would you schedule a backup script to run every night?"
> ✅ **Answer:** "A cron job. I'd run `crontab -e` and add `0 2 * * * /path/backup.sh` to run it at 2 AM daily. The five fields are minute, hour, day of month, month, and day of week — so `0 2 * * *` is minute 0 of hour 2, every day. I'd also redirect output to a log so I can confirm it ran and debug failures."

---

## 4.11 Ten practical scripts

These are the kind of scripts you'd actually write on the job — and great to reference if asked "write a script that…" in an interview.

**1. Check if a website is up**
```bash
#!/bin/bash
URL="https://google.com"
if curl -s --head "$URL" | grep "200 OK" > /dev/null; then
    echo "$URL is UP"
else
    echo "$URL is DOWN"
fi
```

**2. Alert when disk usage is high**
```bash
#!/bin/bash
THRESHOLD=80
usage=$(df / | tail -1 | awk '{print $5}' | tr -d '%')
if [ "$usage" -gt "$THRESHOLD" ]; then
    echo "WARNING: disk is ${usage}% full!"
fi
```

**3. Back up a directory with a timestamp**
```bash
#!/bin/bash
SRC="/home/data"
DEST="/backup"
timestamp=$(date +%Y%m%d_%H%M%S)
tar -czf "$DEST/backup_$timestamp.tar.gz" "$SRC"
echo "Backup created: backup_$timestamp.tar.gz"
```

**4. Check if a service is running, restart if not**
```bash
#!/bin/bash
SERVICE="nginx"
if ! systemctl is-active --quiet "$SERVICE"; then
    echo "$SERVICE is down — restarting"
    systemctl restart "$SERVICE"
fi
```

**5. Delete log files older than 7 days**
```bash
#!/bin/bash
find /var/log/myapp -name "*.log" -mtime +7 -delete
echo "Old logs cleaned up"
```

**6. Count error lines in today's log**
```bash
#!/bin/bash
LOG="/var/log/app.log"
count=$(grep -i "error" "$LOG" | wc -l)
echo "Found $count errors in $LOG"
```

**7. Ping a list of servers**
```bash
#!/bin/bash
servers=("google.com" "github.com" "example.com")
for s in "${servers[@]}"; do
    if ping -c1 -W1 "$s" > /dev/null 2>&1; then
        echo "$s is reachable"
    else
        echo "$s is UNREACHABLE"
    fi
done
```

**8. Rename all .txt files to .bak**
```bash
#!/bin/bash
for file in *.txt; do
    mv "$file" "${file%.txt}.bak"   # %.txt strips the extension
done
echo "Renamed all .txt to .bak"
```

**9. Show top 5 memory-hungry processes**
```bash
#!/bin/bash
echo "Top 5 processes by memory:"
ps aux --sort=-%mem | head -6
```

**10. Simple menu (case statement)**
```bash
#!/bin/bash
echo "1) Disk  2) Memory  3) Uptime"
read -p "Choose: " choice
case $choice in
    1) df -h ;;
    2) free -h ;;
    3) uptime ;;
    *) echo "Invalid choice" ;;
esac
```

> 🏭 **In real production:** Scripts 2, 4, and 5 (disk alert, service watchdog, log cleanup) are the kind of thing that runs on a cron every few minutes on real servers. Being able to sketch one of these on a whiteboard is a strong signal you can do the job.

---

## Chapter 4 — Key Takeaways

- Start with **`#!/bin/bash`** (shebang); `chmod +x` then `./script.sh` to run.
- **Variables:** `name="x"` (no spaces!), read with `$name`, capture commands with `$(...)`. *(★★★★☆)*
- **Arguments:** `$1 $2` positional, `$#` count, `$@` all, `$0` script name. Always validate `$#`. *(★★★★☆)*
- **Conditions:** `if [ ... ]; then` — **spaces inside brackets required**. Numbers: `-eq -ne -gt -lt`. Files: `-f -d -e`. *(★★★★★)*
- **Loops:** `for x in list; do ... done`, `while [ cond ]; do ... done`. Arithmetic in `$(( ))`.
- **Exit codes:** 0 = success; check `$?`; chain with `&&` / `||`. *(★★★★☆)*
- **Cron:** `min hour day-of-month month day-of-week command`. `0 2 * * *` = 2 AM daily. *(★★★★☆)*
- You don't need to be fancy — you need to automate a real task: health check, disk alert, log cleanup, backup.

> **Next:** Chapter 5 — the text-processing power tools: grep, awk, sed, and tr. This is where log analysis gets serious.
