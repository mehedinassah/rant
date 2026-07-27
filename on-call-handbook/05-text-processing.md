# Chapter 5 — grep, awk, sed, tr

> **Why this chapter matters:** Logs are text, and text is where on-call engineers spend their lives. "Here's a log file — find all the failed logins," or "extract every IP that hit a 500 error," is a *classic* live interview task. These four tools — grep, awk, sed, tr — are the Swiss Army knife for slicing text. You don't need mastery; you need to know **which tool for which job** and a handful of patterns.

**The one-line mental model — memorize this, it answers half the questions:**

| Tool | Job in one word | Use it to... |
|------|-----------------|--------------|
| **grep** | **Find** | Find lines that match a pattern |
| **awk** | **Columns** | Extract & compute on columns/fields |
| **sed** | **Edit** | Find-and-replace / edit text in a stream |
| **tr** | **Translate** | Replace or delete individual characters |

> 🧠 **Memory trick:** **grep** grabs lines, **awk** works columns, **sed** substitutes, **tr** translates characters. *Grab, Columns, Substitute, Translate.*

We'll use this sample log throughout:
```
192.168.1.10 - GET /home 200
192.168.1.11 - POST /login 401
192.168.1.10 - GET /data 500
192.168.1.12 - GET /home 200
192.168.1.11 - POST /login 401
```

---

## 5.1 grep — find matching lines ★★★★★

**The most-used of the four. Interviewers assume you know it.**

**Basic idea:** `grep "pattern" file` prints every line containing the pattern.

**The flags that matter (know these cold):**

| Flag | Does | Example |
|------|------|---------|
| `-i` | case-**i**nsensitive | `grep -i error log` (matches Error, ERROR) |
| `-v` | in**v**ert — lines NOT matching | `grep -v 200 log` (non-200s) |
| `-r` | **r**ecursive through directories | `grep -r "TODO" .` |
| `-n` | show line **n**umbers | `grep -n error log` |
| `-c` | **c**ount matching lines | `grep -c 401 log` |
| `-w` | match whole **w**ord only | `grep -w "cat" file` (not "category") |
| `-E` | **E**xtended regex (or use `egrep`) | `grep -E "401|500" log` |
| `-o` | print **o**nly the matched part | `grep -oE "[0-9]+$" log` |
| `-A/-B/-C` | lines **A**fter/**B**efore/**C**ontext | `grep -A3 error log` (3 lines after) |

**Real examples on our log:**
```bash
grep 500 access.log              # → the one 500 error line
grep -c 401 access.log           # → 2 (count of 401s)
grep -v 200 access.log           # → all non-200 lines (the errors)
grep -E "401|500" access.log     # → all 401 AND 500 lines
grep -A2 -B2 "500" access.log    # → the 500 line plus 2 lines around it
```

> 🏭 **In real production:** The single most common on-call move is `grep -i error /var/log/app.log`. Add `| tail -20` for the most recent, or `-A5` to see the stack trace *after* each error. This alone solves a huge share of "what broke?" questions.

> 💬 **Interviewers usually ask:** "Find all lines containing 'error', case-insensitive, and count them."
> ✅ **Answer:** "`grep -ic error file` — `-i` makes it case-insensitive so it catches Error and ERROR, and `-c` counts the matching lines instead of printing them. If I wanted to see them with line numbers instead, I'd use `grep -in error file`."

> 🧠 **Memory trick:** **i**gnore-case, in**v**ert, **r**ecursive, **n**umbers, **c**ount = **i, v, r, n, c**. These five cover almost everything.

---

## 5.2 awk — extract and compute on columns ★★★★★

**awk shines when data is in columns** (which logs almost always are). It automatically splits each line into fields: **`$1` is the first column, `$2` the second, `$0` the whole line.**

**The core pattern:** `awk '{print $N}'` prints column N.

```bash
awk '{print $1}' access.log       # → all IP addresses (first column)
awk '{print $1, $4}' access.log   # → IP and status code
awk '{print $NF}' access.log      # → NF = Number of Fields = LAST column
```

On our log, `awk '{print $1}'` gives:
```
192.168.1.10
192.168.1.11
192.168.1.10
192.168.1.12
192.168.1.11
```

**Filtering with conditions (this is where awk beats grep):**
```bash
awk '$4 == 500' access.log            # lines where column 4 is 500
awk '$4 >= 400 {print $1}' access.log  # IPs of any 4xx/5xx error
awk '$4 == 401 {print $1}' access.log  # who got 401s
```

**Custom delimiter with `-F`** (huge for CSVs and `/etc/passwd`):
```bash
awk -F',' '{print $2}' data.csv        # 2nd column of a CSV
awk -F':' '{print $1}' /etc/passwd     # all usernames (colon-separated)
```

**Computing — sum, count, average:**
```bash
awk '{sum += $3} END {print sum}' numbers.txt    # total a column
awk 'END {print NR}' access.log                  # NR = row count = line count
awk '{count[$1]++} END {for (ip in count) print ip, count[ip]}' access.log
#   ↑ count requests per IP — a genuine log-analysis one-liner
```

> 🏭 **In real production:** "Which IP is hammering us?" → `awk '{print $1}' access.log | sort | uniq -c | sort -rn | head` — extract IPs, count each, sort by count. That pipeline is a rite of passage for support engineers.

> 💬 **Interviewers usually ask:** "From this log, print only the IP addresses of requests that returned a 500."
> ✅ **Answer:** "`awk '$4 == 500 {print $1}' access.log`. awk splits each line into fields automatically, so `$4` is the status code and `$1` is the IP. The condition `$4 == 500` filters to just those lines, and `{print $1}` prints the IP. That's the kind of thing awk does far more cleanly than grep, because grep matches whole lines while awk understands columns."

> 🧠 **Memory trick:** awk = **A**ll about columns. `$1 $2 $3` = columns, `$NF` = last field, `$0` = whole line, `-F` = field separator, `NR` = number of rows.

---

## 5.3 sed — stream editor (find & replace) ★★★★☆

**sed edits text as it streams past** — most famously for find-and-replace, without opening an editor.

**The killer feature — substitution:** `s/old/new/`
```bash
sed 's/error/ERROR/' log.txt        # replace FIRST "error" on each line
sed 's/error/ERROR/g' log.txt       # g = GLOBAL — replace ALL on each line
sed 's/error/ERROR/gi' log.txt      # g + i = all, case-insensitive
```

> ⚠️ **Common mistake:** Forgetting the **`g`** flag. Without it, `sed` only replaces the *first* match on each line. `g` = global = all matches on the line.

**In-place editing (actually change the file):**
```bash
sed -i 's/old/new/g' config.txt         # -i edits the file directly
sed -i.bak 's/old/new/g' config.txt      # -i.bak makes a backup first (safer!)
```

**Other handy sed moves:**
```bash
sed -n '5,10p' file.txt         # print only lines 5–10 (-n + p)
sed '2d' file.txt               # delete line 2
sed '/debug/d' file.txt         # delete every line containing "debug"
sed 's/^/> /' file.txt          # add "> " to the start of each line (^ = start)
```

> 🏭 **In real production:** Changing a config value across servers — `sed -i 's/port=8080/port=9090/' app.conf` — is a everyday sed use. The `-i.bak` habit (make a backup) has saved many engineers from a bad regex.

> 💬 **Interviewers usually ask:** "How would you replace every occurrence of 'foo' with 'bar' in a file?"
> ✅ **Answer:** "`sed -i 's/foo/bar/g' file`. The `s` command substitutes, the `g` flag makes it replace *every* occurrence on each line rather than just the first, and `-i` edits the file in place. I'd often use `-i.bak` instead so it keeps a backup — regex mistakes on a live config file are easy to make and hard to undo."

> 🧠 **Memory trick:** sed = **s**ubstitute: **`s/old/new/g`**. **`g` = global (all), `i` = ignore case, `-i` = in-place (edit the actual file).** Don't forget the `g`!

---

## 5.4 tr — translate/delete characters ★★★☆☆

**tr works on individual characters**, not patterns or words. It reads from standard input (use it in a pipe).

```bash
echo "hello" | tr 'a-z' 'A-Z'         # → HELLO (lowercase to uppercase)
echo "hello world" | tr ' ' '_'        # → hello_world (spaces to underscores)
echo "hello" | tr -d 'l'               # → heo (-d = delete chars)
echo "a,b,c" | tr ',' '\n'             # → each on its own line (comma → newline)
cat file | tr -s ' '                   # -s = squeeze repeated spaces into one
echo "Phone: 555-1234" | tr -cd '0-9'  # -c -d = keep ONLY digits → 5551234
```

**The flags:** `-d` delete, `-s` squeeze (collapse repeats), `-c` complement (invert the set — "everything except").

> 🏭 **In real production:** Cleaning messy data — `tr -d '\r'` to strip Windows carriage returns from a file, or `tr -s ' '` to squeeze irregular spacing before feeding to awk. Small but constantly useful.

> 💬 **Interviewers usually ask:** "How do you convert a file to uppercase / remove all digits?"
> ✅ **Answer:** "`tr 'a-z' 'A-Z'` to uppercase, piping the file in. To remove digits, `tr -d '0-9'`. tr operates on individual characters rather than words or patterns, so it's the right tool for character-level transforms — case changes, deleting or squeezing specific characters, swapping delimiters."

> 🧠 **Memory trick:** **tr = translate characters.** Two sets = swap; `-d` = delete; `-s` = squeeze; `-c` = complement (everything but).

---

## 5.5 Putting it together — the log-analysis pipelines ★★★★★

**This is what separates a strong candidate.** Real answers *combine* these tools with pipes, `sort`, and `uniq`. Two more tools to know:

- **`sort`** — order lines. `-n` numeric, `-r` reverse, `-rn` = biggest first.
- **`uniq -c`** — collapse duplicate *adjacent* lines and count them (**must `sort` first**).

**The single most useful log pipeline (learn it by heart):**
```bash
awk '{print $1}' access.log | sort | uniq -c | sort -rn | head
```
Read it left to right: *extract IPs → sort them → count duplicates → sort by count descending → show the top few.* Result: your top traffic sources.

**More real-world one-liners:**
```bash
# Count how many of each HTTP status code:
awk '{print $4}' access.log | sort | uniq -c | sort -rn

# Top 10 URLs requested:
awk '{print $3}' access.log | sort | uniq -c | sort -rn | head

# All unique IPs that caused a 500 error:
awk '$4 == 500 {print $1}' access.log | sort | uniq

# Find failed logins, extract the IP, count offenders:
grep "401" access.log | awk '{print $1}' | sort | uniq -c | sort -rn
```

> 💬 **Interviewers usually ask:** "Given a web server log, find the top 5 IP addresses making requests."
> ✅ **Model answer:** "`awk '{print $1}' access.log | sort | uniq -c | sort -rn | head -5`. I use awk to pull the IP from the first column, sort so identical IPs are adjacent, `uniq -c` to collapse and count them — that's why the sort comes first, uniq only compares adjacent lines — then `sort -rn` to order by count descending, and `head -5` for the top five. It's a pipeline where each tool does one job: extract, group, count, rank."

> 🧠 **Memory trick — the golden pipeline:** **extract → sort → uniq -c → sort -rn → head.** Whenever you hear "top N" or "count each," reach for this shape.

---

## 5.6 grep vs awk vs sed — the decision guide

When you're not sure which to reach for:

```
Need to FIND lines matching a pattern?          →  grep
Need to EXTRACT a column / filter by a field?   →  awk
Need to REPLACE / edit text?                     →  sed
Need to change/delete individual characters?     →  tr
Need to COUNT occurrences of things?             →  awk … | sort | uniq -c
```

> ⚠️ **Common mistake:** Using the wrong tool and fighting it. grep can't easily pick "column 4"; awk isn't for find-and-replace across a file; sed isn't for math on columns. Match the tool to the job and the one-liner writes itself.

---

## Chapter 5 — Key Takeaways

- **grep = find lines.** Flags: `-i` ignore case, `-v` invert, `-r` recursive, `-n` numbers, `-c` count. *(★★★★★)*
- **awk = columns.** `$1 $2 $NF`, filter with `$4 == 500`, `-F` sets the delimiter, `NR` counts rows. Best for extracting fields. *(★★★★★)*
- **sed = substitute.** `sed 's/old/new/g'` (don't forget `g`!), `-i` edits in place, `-i.bak` keeps a backup. *(★★★★☆)*
- **tr = translate characters.** Swap sets, `-d` delete, `-s` squeeze, `-c` complement. *(★★★☆☆)*
- **The golden pipeline:** `... | sort | uniq -c | sort -rn | head` for any "top N / count each" question. *(★★★★★)*
- Match the tool to the job: **find→grep, columns→awk, replace→sed, characters→tr.**

> **Next:** Chapter 6 — Git. Short but high-yield: the commands you use daily plus the merge-vs-rebase and conflict questions interviewers can't resist.
