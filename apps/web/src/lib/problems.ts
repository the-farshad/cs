export type Problem = {
  slug: string;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  topic: string;
  prompt: string;
  funcName: { python: string; javascript: string };
  starter: { python: string; javascript: string };
  tests: { args: unknown[]; expected: unknown }[];
  solutions: { language: string; code: string }[];
};

export const PROBLEMS: Problem[] = [
  {
    slug: 'two-sum',
    title: 'Two Sum',
    difficulty: 'easy',
    topic: 'Arrays & Hashing',
    prompt:
      'Given an array of integers `nums` and an integer `target`, return the indices of the two numbers that add up to `target`. Each input has exactly one solution, and you may not use the same element twice.\n\nExample: nums = [2, 7, 11, 15], target = 9 → [0, 1] (because 2 + 7 = 9).',
    funcName: { python: 'two_sum', javascript: 'twoSum' },
    starter: {
      python: 'def two_sum(nums, target):\n    # your code here\n    pass',
      javascript: 'function twoSum(nums, target) {\n  // your code here\n}',
    },
    tests: [
      { args: [[2, 7, 11, 15], 9], expected: [0, 1] },
      { args: [[3, 2, 4], 6], expected: [1, 2] },
      { args: [[3, 3], 6], expected: [0, 1] },
    ],
    solutions: [
      { language: 'python', code: 'def two_sum(nums, target):\n    seen = {}\n    for i, n in enumerate(nums):\n        if target - n in seen:\n            return [seen[target - n], i]\n        seen[n] = i\n    return []' },
      { language: 'javascript', code: 'function twoSum(nums, target) {\n  const seen = new Map();\n  for (let i = 0; i < nums.length; i++) {\n    if (seen.has(target - nums[i])) return [seen.get(target - nums[i]), i];\n    seen.set(nums[i], i);\n  }\n  return [];\n}' },
      { language: 'cpp', code: 'vector<int> twoSum(vector<int>& nums, int target) {\n    unordered_map<int,int> seen;\n    for (int i = 0; i < nums.size(); i++) {\n        if (seen.count(target - nums[i])) return {seen[target - nums[i]], i};\n        seen[nums[i]] = i;\n    }\n    return {};\n}' },
      { language: 'java', code: 'int[] twoSum(int[] nums, int target) {\n    Map<Integer,Integer> seen = new HashMap<>();\n    for (int i = 0; i < nums.length; i++) {\n        if (seen.containsKey(target - nums[i]))\n            return new int[]{seen.get(target - nums[i]), i};\n        seen.put(nums[i], i);\n    }\n    return new int[]{};\n}' },
      { language: 'pseudocode', code: 'function twoSum(nums, target):\n    seen = empty map\n    for i, n in nums:\n        if (target - n) in seen:\n            return [seen[target - n], i]\n        seen[n] = i\n    return []' },
    ],
  },
  {
    slug: 'reverse-string',
    title: 'Reverse a String',
    difficulty: 'easy',
    topic: 'Strings',
    prompt: 'Return the input string reversed.\n\nExample: "hello" → "olleh".',
    funcName: { python: 'reverse_string', javascript: 'reverseString' },
    starter: {
      python: 'def reverse_string(s):\n    # your code here\n    pass',
      javascript: 'function reverseString(s) {\n  // your code here\n}',
    },
    tests: [
      { args: ['hello'], expected: 'olleh' },
      { args: ['abc'], expected: 'cba' },
      { args: [''], expected: '' },
    ],
    solutions: [
      { language: 'python', code: 'def reverse_string(s):\n    return s[::-1]' },
      { language: 'javascript', code: "function reverseString(s) {\n  return s.split('').reverse().join('');\n}" },
      { language: 'cpp', code: 'string reverseString(string s) {\n    reverse(s.begin(), s.end());\n    return s;\n}' },
      { language: 'java', code: 'String reverseString(String s) {\n    return new StringBuilder(s).reverse().toString();\n}' },
      { language: 'pseudocode', code: 'function reverseString(s):\n    result = ""\n    for c from last char of s to first:\n        result = result + c\n    return result' },
    ],
  },
  {
    slug: 'fizzbuzz',
    title: 'FizzBuzz',
    difficulty: 'easy',
    topic: 'Math & Strings',
    prompt:
      'Return a list of strings for the numbers 1..n: "Fizz" if divisible by 3, "Buzz" if by 5, "FizzBuzz" if by both, otherwise the number itself as a string.\n\nExample: n = 5 → ["1", "2", "Fizz", "4", "Buzz"].',
    funcName: { python: 'fizzbuzz', javascript: 'fizzBuzz' },
    starter: {
      python: 'def fizzbuzz(n):\n    # your code here\n    pass',
      javascript: 'function fizzBuzz(n) {\n  // your code here\n}',
    },
    tests: [
      { args: [5], expected: ['1', '2', 'Fizz', '4', 'Buzz'] },
      { args: [3], expected: ['1', '2', 'Fizz'] },
      { args: [15], expected: ['1', '2', 'Fizz', '4', 'Buzz', 'Fizz', '7', '8', 'Fizz', 'Buzz', '11', 'Fizz', '13', '14', 'FizzBuzz'] },
    ],
    solutions: [
      { language: 'python', code: 'def fizzbuzz(n):\n    out = []\n    for i in range(1, n + 1):\n        if i % 15 == 0: out.append("FizzBuzz")\n        elif i % 3 == 0: out.append("Fizz")\n        elif i % 5 == 0: out.append("Buzz")\n        else: out.append(str(i))\n    return out' },
      { language: 'javascript', code: 'function fizzBuzz(n) {\n  const out = [];\n  for (let i = 1; i <= n; i++) {\n    if (i % 15 === 0) out.push("FizzBuzz");\n    else if (i % 3 === 0) out.push("Fizz");\n    else if (i % 5 === 0) out.push("Buzz");\n    else out.push(String(i));\n  }\n  return out;\n}' },
      { language: 'cpp', code: 'vector<string> fizzBuzz(int n) {\n    vector<string> out;\n    for (int i = 1; i <= n; i++) {\n        if (i % 15 == 0) out.push_back("FizzBuzz");\n        else if (i % 3 == 0) out.push_back("Fizz");\n        else if (i % 5 == 0) out.push_back("Buzz");\n        else out.push_back(to_string(i));\n    }\n    return out;\n}' },
      { language: 'java', code: 'List<String> fizzBuzz(int n) {\n    List<String> out = new ArrayList<>();\n    for (int i = 1; i <= n; i++) {\n        if (i % 15 == 0) out.add("FizzBuzz");\n        else if (i % 3 == 0) out.add("Fizz");\n        else if (i % 5 == 0) out.add("Buzz");\n        else out.add(String.valueOf(i));\n    }\n    return out;\n}' },
      { language: 'pseudocode', code: 'function fizzBuzz(n):\n    out = []\n    for i from 1 to n:\n        if i divisible by 15: append "FizzBuzz"\n        else if i divisible by 3: append "Fizz"\n        else if i divisible by 5: append "Buzz"\n        else: append string(i)\n    return out' },
    ],
  },
  {
    slug: 'binary-search',
    title: 'Binary Search',
    difficulty: 'easy',
    topic: 'Searching',
    prompt:
      'Given a sorted (ascending) array `nums` and a `target`, return the index of `target`, or -1 if it is not present. Aim for O(log n).\n\nExample: nums = [1, 3, 5, 7, 9], target = 7 → 3.',
    funcName: { python: 'binary_search', javascript: 'binarySearch' },
    starter: {
      python: 'def binary_search(nums, target):\n    # your code here\n    pass',
      javascript: 'function binarySearch(nums, target) {\n  // your code here\n}',
    },
    tests: [
      { args: [[1, 3, 5, 7, 9], 7], expected: 3 },
      { args: [[1, 3, 5, 7, 9], 2], expected: -1 },
      { args: [[1], 1], expected: 0 },
      { args: [[], 5], expected: -1 },
    ],
    solutions: [
      { language: 'python', code: 'def binary_search(nums, target):\n    lo, hi = 0, len(nums) - 1\n    while lo <= hi:\n        mid = (lo + hi) // 2\n        if nums[mid] == target: return mid\n        if nums[mid] < target: lo = mid + 1\n        else: hi = mid - 1\n    return -1' },
      { language: 'javascript', code: 'function binarySearch(nums, target) {\n  let lo = 0, hi = nums.length - 1;\n  while (lo <= hi) {\n    const mid = (lo + hi) >> 1;\n    if (nums[mid] === target) return mid;\n    if (nums[mid] < target) lo = mid + 1;\n    else hi = mid - 1;\n  }\n  return -1;\n}' },
      { language: 'cpp', code: 'int binarySearch(vector<int>& nums, int target) {\n    int lo = 0, hi = (int)nums.size() - 1;\n    while (lo <= hi) {\n        int mid = lo + (hi - lo) / 2;\n        if (nums[mid] == target) return mid;\n        if (nums[mid] < target) lo = mid + 1;\n        else hi = mid - 1;\n    }\n    return -1;\n}' },
      { language: 'java', code: 'int binarySearch(int[] nums, int target) {\n    int lo = 0, hi = nums.length - 1;\n    while (lo <= hi) {\n        int mid = lo + (hi - lo) / 2;\n        if (nums[mid] == target) return mid;\n        if (nums[mid] < target) lo = mid + 1;\n        else hi = mid - 1;\n    }\n    return -1;\n}' },
      { language: 'pseudocode', code: 'function binarySearch(nums, target):\n    lo = 0, hi = length(nums) - 1\n    while lo <= hi:\n        mid = (lo + hi) / 2\n        if nums[mid] == target: return mid\n        if nums[mid] < target: lo = mid + 1\n        else: hi = mid - 1\n    return -1' },
    ],
  },
  {
    slug: 'valid-parentheses',
    title: 'Valid Parentheses',
    difficulty: 'easy',
    topic: 'Stacks',
    prompt:
      'Given a string `s` of just the characters ()[]{}, return true if every bracket is closed by the same type in the correct order.\n\nExample: "()[]{}" → true,  "(]" → false,  "([)]" → false.',
    funcName: { python: 'is_valid', javascript: 'isValid' },
    starter: {
      python: 'def is_valid(s):\n    # your code here\n    pass',
      javascript: 'function isValid(s) {\n  // your code here\n}',
    },
    tests: [
      { args: ['()[]{}'], expected: true },
      { args: ['(]'], expected: false },
      { args: ['([)]'], expected: false },
      { args: ['{[]}'], expected: true },
      { args: [''], expected: true },
    ],
    solutions: [
      { language: 'python', code: "def is_valid(s):\n    stack = []\n    pairs = {')': '(', ']': '[', '}': '{'}\n    for c in s:\n        if c in '([{':\n            stack.append(c)\n        elif not stack or stack.pop() != pairs[c]:\n            return False\n    return not stack" },
      { language: 'javascript', code: "function isValid(s) {\n  const stack = [];\n  const pairs = { ')': '(', ']': '[', '}': '{' };\n  for (const c of s) {\n    if (c === '(' || c === '[' || c === '{') stack.push(c);\n    else if (!stack.length || stack.pop() !== pairs[c]) return false;\n  }\n  return stack.length === 0;\n}" },
      { language: 'cpp', code: 'bool isValid(string s) {\n    stack<char> st;\n    unordered_map<char,char> pairs{{\')\',\'(\'},{\']\',\'[\'},{\'}\',\'{\'}};\n    for (char c : s) {\n        if (c==\'(\'||c==\'[\'||c==\'{\') st.push(c);\n        else if (st.empty() || st.top()!=pairs[c]) return false;\n        else st.pop();\n    }\n    return st.empty();\n}' },
      { language: 'java', code: 'boolean isValid(String s) {\n    Deque<Character> st = new ArrayDeque<>();\n    Map<Character,Character> pairs = Map.of(\')\',\'(\', \']\',\'[\', \'}\',\'{\');\n    for (char c : s.toCharArray()) {\n        if (c==\'(\'||c==\'[\'||c==\'{\') st.push(c);\n        else if (st.isEmpty() || st.pop()!=pairs.get(c)) return false;\n    }\n    return st.isEmpty();\n}' },
      { language: 'pseudocode', code: 'function isValid(s):\n    stack = empty\n    for c in s:\n        if c is an opening bracket: push c\n        else:\n            if stack empty or top does not match c: return false\n            pop\n    return stack is empty' },
    ],
  },
  {
    slug: 'maximum-subarray',
    title: 'Maximum Subarray',
    difficulty: 'medium',
    topic: 'Dynamic Programming',
    prompt:
      'Given an integer array `nums`, return the largest sum of any contiguous subarray (at least one element). Use Kadane’s algorithm for O(n).\n\nExample: [-2, 1, -3, 4, -1, 2, 1, -5, 4] → 6 (the subarray [4, -1, 2, 1]).',
    funcName: { python: 'max_subarray', javascript: 'maxSubArray' },
    starter: {
      python: 'def max_subarray(nums):\n    # your code here\n    pass',
      javascript: 'function maxSubArray(nums) {\n  // your code here\n}',
    },
    tests: [
      { args: [[-2, 1, -3, 4, -1, 2, 1, -5, 4]], expected: 6 },
      { args: [[1]], expected: 1 },
      { args: [[5, 4, -1, 7, 8]], expected: 23 },
      { args: [[-3, -1, -2]], expected: -1 },
    ],
    solutions: [
      { language: 'python', code: 'def max_subarray(nums):\n    best = cur = nums[0]\n    for n in nums[1:]:\n        cur = max(n, cur + n)\n        best = max(best, cur)\n    return best' },
      { language: 'javascript', code: 'function maxSubArray(nums) {\n  let best = nums[0], cur = nums[0];\n  for (let i = 1; i < nums.length; i++) {\n    cur = Math.max(nums[i], cur + nums[i]);\n    best = Math.max(best, cur);\n  }\n  return best;\n}' },
      { language: 'cpp', code: 'int maxSubArray(vector<int>& nums) {\n    int best = nums[0], cur = nums[0];\n    for (int i = 1; i < nums.size(); i++) {\n        cur = max(nums[i], cur + nums[i]);\n        best = max(best, cur);\n    }\n    return best;\n}' },
      { language: 'java', code: 'int maxSubArray(int[] nums) {\n    int best = nums[0], cur = nums[0];\n    for (int i = 1; i < nums.length; i++) {\n        cur = Math.max(nums[i], cur + nums[i]);\n        best = Math.max(best, cur);\n    }\n    return best;\n}' },
      { language: 'pseudocode', code: 'function maxSubArray(nums):\n    best = cur = nums[0]\n    for n in nums[1..]:\n        cur = max(n, cur + n)   // extend or restart\n        best = max(best, cur)\n    return best' },
    ],
  },
  {
    slug: 'palindrome-number',
    title: 'Palindrome Number',
    difficulty: 'easy',
    topic: 'Math',
    prompt: 'Return true if integer `x` reads the same forwards and backwards. Negative numbers are not palindromes.\n\nExample: 121 → true; -121 → false; 10 → false.',
    funcName: { python: 'is_palindrome', javascript: 'isPalindrome' },
    starter: {
      python: 'def is_palindrome(x):\n    # your code here\n    pass',
      javascript: 'function isPalindrome(x) {\n  // your code here\n}',
    },
    tests: [
      { args: [121], expected: true },
      { args: [-121], expected: false },
      { args: [10], expected: false },
      { args: [0], expected: true },
    ],
    solutions: [
      { language: 'python', code: "def is_palindrome(x):\n    if x < 0:\n        return False\n    s = str(x)\n    return s == s[::-1]" },
      { language: 'javascript', code: "function isPalindrome(x) {\n  if (x < 0) return false;\n  const s = String(x);\n  return s === s.split('').reverse().join('');\n}" },
      { language: 'cpp', code: "bool isPalindrome(int x) {\n    if (x < 0) return false;\n    string s = to_string(x), r = s;\n    reverse(r.begin(), r.end());\n    return s == r;\n}" },
      { language: 'java', code: "boolean isPalindrome(int x) {\n    if (x < 0) return false;\n    String s = Integer.toString(x);\n    return s.equals(new StringBuilder(s).reverse().toString());\n}" },
      { language: 'pseudocode', code: "function isPalindrome(x):\n    if x < 0: return false\n    s = digits of x\n    return s equals reverse(s)" },
    ],
  },
  {
    slug: 'contains-duplicate',
    title: 'Contains Duplicate',
    difficulty: 'easy',
    topic: 'Arrays & Hashing',
    prompt: 'Return true if any value appears at least twice in `nums`, and false if every element is distinct.\n\nExample: [1, 2, 3, 1] → true; [1, 2, 3, 4] → false.',
    funcName: { python: 'contains_duplicate', javascript: 'containsDuplicate' },
    starter: {
      python: 'def contains_duplicate(nums):\n    # your code here\n    pass',
      javascript: 'function containsDuplicate(nums) {\n  // your code here\n}',
    },
    tests: [
      { args: [[1, 2, 3, 1]], expected: true },
      { args: [[1, 2, 3, 4]], expected: false },
      { args: [[]], expected: false },
      { args: [[1, 1, 1, 3, 3, 4, 3, 2, 4, 2]], expected: true },
    ],
    solutions: [
      { language: 'python', code: "def contains_duplicate(nums):\n    return len(set(nums)) != len(nums)" },
      { language: 'javascript', code: "function containsDuplicate(nums) {\n  return new Set(nums).size !== nums.length;\n}" },
      { language: 'cpp', code: "bool containsDuplicate(vector<int>& nums) {\n    unordered_set<int> seen;\n    for (int n : nums) if (!seen.insert(n).second) return true;\n    return false;\n}" },
      { language: 'java', code: "boolean containsDuplicate(int[] nums) {\n    Set<Integer> seen = new HashSet<>();\n    for (int n : nums) if (!seen.add(n)) return true;\n    return false;\n}" },
      { language: 'pseudocode', code: "function containsDuplicate(nums):\n    seen = empty set\n    for n in nums:\n        if n in seen: return true\n        add n to seen\n    return false" },
    ],
  },
  {
    slug: 'valid-anagram',
    title: 'Valid Anagram',
    difficulty: 'easy',
    topic: 'Strings & Hashing',
    prompt: 'Return true if `t` is an anagram of `s` — the same letters with the same counts, reordered.\n\nExample: s = "anagram", t = "nagaram" → true; s = "rat", t = "car" → false.',
    funcName: { python: 'is_anagram', javascript: 'isAnagram' },
    starter: {
      python: 'def is_anagram(s, t):\n    # your code here\n    pass',
      javascript: 'function isAnagram(s, t) {\n  // your code here\n}',
    },
    tests: [
      { args: ['anagram', 'nagaram'], expected: true },
      { args: ['rat', 'car'], expected: false },
      { args: ['a', 'ab'], expected: false },
    ],
    solutions: [
      { language: 'python', code: "def is_anagram(s, t):\n    return sorted(s) == sorted(t)" },
      { language: 'javascript', code: "function isAnagram(s, t) {\n  const key = (x) => x.split('').sort().join('');\n  return key(s) === key(t);\n}" },
      { language: 'cpp', code: "bool isAnagram(string s, string t) {\n    sort(s.begin(), s.end());\n    sort(t.begin(), t.end());\n    return s == t;\n}" },
      { language: 'java', code: "boolean isAnagram(String s, String t) {\n    char[] a = s.toCharArray(), b = t.toCharArray();\n    Arrays.sort(a); Arrays.sort(b);\n    return Arrays.equals(a, b);\n}" },
      { language: 'pseudocode', code: "function isAnagram(s, t):\n    return sorted(s) == sorted(t)" },
    ],
  },
  {
    slug: 'best-time-to-buy-sell-stock',
    title: 'Best Time to Buy and Sell Stock',
    difficulty: 'easy',
    topic: 'Arrays & DP',
    prompt: 'Given daily `prices`, return the maximum profit from buying on one day and selling on a later day. If no profit is possible, return 0.\n\nExample: [7, 1, 5, 3, 6, 4] → 5 (buy at 1, sell at 6).',
    funcName: { python: 'max_profit', javascript: 'maxProfit' },
    starter: {
      python: 'def max_profit(prices):\n    # your code here\n    pass',
      javascript: 'function maxProfit(prices) {\n  // your code here\n}',
    },
    tests: [
      { args: [[7, 1, 5, 3, 6, 4]], expected: 5 },
      { args: [[7, 6, 4, 3, 1]], expected: 0 },
      { args: [[1, 2]], expected: 1 },
      { args: [[2]], expected: 0 },
    ],
    solutions: [
      { language: 'python', code: "def max_profit(prices):\n    best, lo = 0, float('inf')\n    for p in prices:\n        lo = min(lo, p)\n        best = max(best, p - lo)\n    return best" },
      { language: 'javascript', code: "function maxProfit(prices) {\n  let best = 0, lo = Infinity;\n  for (const p of prices) { lo = Math.min(lo, p); best = Math.max(best, p - lo); }\n  return best;\n}" },
      { language: 'cpp', code: "int maxProfit(vector<int>& prices) {\n    int best = 0, lo = INT_MAX;\n    for (int p : prices) { lo = min(lo, p); best = max(best, p - lo); }\n    return best;\n}" },
      { language: 'java', code: "int maxProfit(int[] prices) {\n    int best = 0, lo = Integer.MAX_VALUE;\n    for (int p : prices) { lo = Math.min(lo, p); best = Math.max(best, p - lo); }\n    return best;\n}" },
      { language: 'pseudocode', code: "function maxProfit(prices):\n    best = 0; lo = +infinity\n    for p in prices:\n        lo = min(lo, p)\n        best = max(best, p - lo)\n    return best" },
    ],
  },
  {
    slug: 'move-zeroes',
    title: 'Move Zeroes',
    difficulty: 'easy',
    topic: 'Two Pointers',
    prompt: 'Move all 0s to the end of `nums` while keeping the order of the non-zero elements, and return the resulting array.\n\nExample: [0, 1, 0, 3, 12] → [1, 3, 12, 0, 0].',
    funcName: { python: 'move_zeroes', javascript: 'moveZeroes' },
    starter: {
      python: 'def move_zeroes(nums):\n    # your code here\n    pass',
      javascript: 'function moveZeroes(nums) {\n  // your code here\n}',
    },
    tests: [
      { args: [[0, 1, 0, 3, 12]], expected: [1, 3, 12, 0, 0] },
      { args: [[0]], expected: [0] },
      { args: [[1, 2, 3]], expected: [1, 2, 3] },
    ],
    solutions: [
      { language: 'python', code: "def move_zeroes(nums):\n    nonzero = [n for n in nums if n != 0]\n    return nonzero + [0] * (len(nums) - len(nonzero))" },
      { language: 'javascript', code: "function moveZeroes(nums) {\n  const nz = nums.filter((n) => n !== 0);\n  while (nz.length < nums.length) nz.push(0);\n  return nz;\n}" },
      { language: 'cpp', code: "vector<int> moveZeroes(vector<int>& nums) {\n    vector<int> r;\n    for (int n : nums) if (n != 0) r.push_back(n);\n    r.resize(nums.size(), 0);\n    return r;\n}" },
      { language: 'java', code: "int[] moveZeroes(int[] nums) {\n    int[] r = new int[nums.length];\n    int i = 0;\n    for (int n : nums) if (n != 0) r[i++] = n;\n    return r;\n}" },
      { language: 'pseudocode', code: "function moveZeroes(nums):\n    result = the non-zero elements of nums, in order\n    pad result with 0s up to length(nums)\n    return result" },
    ],
  },
  {
    slug: 'climbing-stairs',
    title: 'Climbing Stairs',
    difficulty: 'easy',
    topic: 'Dynamic Programming',
    prompt: 'You climb a staircase of `n` steps, taking 1 or 2 steps at a time. Return the number of distinct ways to reach the top.\n\nExample: n = 3 → 3 (1+1+1, 1+2, 2+1).',
    funcName: { python: 'climb_stairs', javascript: 'climbStairs' },
    starter: {
      python: 'def climb_stairs(n):\n    # your code here\n    pass',
      javascript: 'function climbStairs(n) {\n  // your code here\n}',
    },
    tests: [
      { args: [2], expected: 2 },
      { args: [3], expected: 3 },
      { args: [5], expected: 8 },
      { args: [1], expected: 1 },
    ],
    solutions: [
      { language: 'python', code: "def climb_stairs(n):\n    a, b = 1, 1\n    for _ in range(n):\n        a, b = b, a + b\n    return a" },
      { language: 'javascript', code: "function climbStairs(n) {\n  let a = 1, b = 1;\n  for (let i = 0; i < n; i++) { const t = a + b; a = b; b = t; }\n  return a;\n}" },
      { language: 'cpp', code: "int climbStairs(int n) {\n    int a = 1, b = 1;\n    for (int i = 0; i < n; i++) { int t = a + b; a = b; b = t; }\n    return a;\n}" },
      { language: 'java', code: "int climbStairs(int n) {\n    int a = 1, b = 1;\n    for (int i = 0; i < n; i++) { int t = a + b; a = b; b = t; }\n    return a;\n}" },
      { language: 'pseudocode', code: "function climbStairs(n):\n    a = b = 1\n    repeat n times: (a, b) = (b, a + b)\n    return a" },
    ],
  },
  {
    slug: 'single-number',
    title: 'Single Number',
    difficulty: 'easy',
    topic: 'Bit Manipulation',
    prompt: 'Every element in `nums` appears exactly twice except for one. Return that single element. (Hint: XOR cancels equal pairs.)\n\nExample: [4, 1, 2, 1, 2] → 4.',
    funcName: { python: 'single_number', javascript: 'singleNumber' },
    starter: {
      python: 'def single_number(nums):\n    # your code here\n    pass',
      javascript: 'function singleNumber(nums) {\n  // your code here\n}',
    },
    tests: [
      { args: [[2, 2, 1]], expected: 1 },
      { args: [[4, 1, 2, 1, 2]], expected: 4 },
      { args: [[1]], expected: 1 },
    ],
    solutions: [
      { language: 'python', code: "def single_number(nums):\n    r = 0\n    for n in nums:\n        r ^= n\n    return r" },
      { language: 'javascript', code: "function singleNumber(nums) {\n  return nums.reduce((a, b) => a ^ b, 0);\n}" },
      { language: 'cpp', code: "int singleNumber(vector<int>& nums) {\n    int r = 0;\n    for (int n : nums) r ^= n;\n    return r;\n}" },
      { language: 'java', code: "int singleNumber(int[] nums) {\n    int r = 0;\n    for (int n : nums) r ^= n;\n    return r;\n}" },
      { language: 'pseudocode', code: "function singleNumber(nums):\n    r = 0\n    for n in nums: r = r XOR n\n    return r" },
    ],
  },
  {
    slug: 'valid-palindrome',
    title: 'Valid Palindrome',
    difficulty: 'easy',
    topic: 'Two Pointers',
    prompt: 'Return true if `s` is a palindrome, considering only alphanumeric characters and ignoring case.\n\nExample: "A man, a plan, a canal: Panama" → true; "race a car" → false.',
    funcName: { python: 'valid_palindrome', javascript: 'validPalindrome' },
    starter: {
      python: 'def valid_palindrome(s):\n    # your code here\n    pass',
      javascript: 'function validPalindrome(s) {\n  // your code here\n}',
    },
    tests: [
      { args: ['A man, a plan, a canal: Panama'], expected: true },
      { args: ['race a car'], expected: false },
      { args: [''], expected: true },
    ],
    solutions: [
      { language: 'python', code: "def valid_palindrome(s):\n    t = [c.lower() for c in s if c.isalnum()]\n    return t == t[::-1]" },
      { language: 'javascript', code: "function validPalindrome(s) {\n  const t = s.toLowerCase().replace(/[^a-z0-9]/g, '');\n  return t === t.split('').reverse().join('');\n}" },
      { language: 'cpp', code: "bool validPalindrome(string s) {\n    string t;\n    for (char c : s) if (isalnum((unsigned char)c)) t += tolower(c);\n    string r = t;\n    reverse(r.begin(), r.end());\n    return t == r;\n}" },
      { language: 'java', code: "boolean validPalindrome(String s) {\n    StringBuilder b = new StringBuilder();\n    for (char c : s.toLowerCase().toCharArray())\n        if (Character.isLetterOrDigit(c)) b.append(c);\n    return b.toString().equals(b.reverse().toString());\n}" },
      { language: 'pseudocode', code: "function validPalindrome(s):\n    t = alphanumeric chars of s, lowercased\n    return t equals reverse(t)" },
    ],
  },
  {
    slug: 'plus-one',
    title: 'Plus One',
    difficulty: 'easy',
    topic: 'Arrays & Math',
    prompt: '`digits` represents a non-negative integer, one digit per element (most significant first). Add one to it and return the resulting digits.\n\nExample: [1, 2, 3] → [1, 2, 4]; [9, 9] → [1, 0, 0].',
    funcName: { python: 'plus_one', javascript: 'plusOne' },
    starter: {
      python: 'def plus_one(digits):\n    # your code here\n    pass',
      javascript: 'function plusOne(digits) {\n  // your code here\n}',
    },
    tests: [
      { args: [[1, 2, 3]], expected: [1, 2, 4] },
      { args: [[9, 9]], expected: [1, 0, 0] },
      { args: [[0]], expected: [1] },
      { args: [[4, 3, 2, 1]], expected: [4, 3, 2, 2] },
    ],
    solutions: [
      { language: 'python', code: "def plus_one(digits):\n    for i in range(len(digits) - 1, -1, -1):\n        if digits[i] < 9:\n            digits[i] += 1\n            return digits\n        digits[i] = 0\n    return [1] + digits" },
      { language: 'javascript', code: "function plusOne(digits) {\n  const d = digits.slice();\n  for (let i = d.length - 1; i >= 0; i--) {\n    if (d[i] < 9) { d[i]++; return d; }\n    d[i] = 0;\n  }\n  return [1, ...d];\n}" },
      { language: 'cpp', code: "vector<int> plusOne(vector<int>& digits) {\n    for (int i = digits.size() - 1; i >= 0; i--) {\n        if (digits[i] < 9) { digits[i]++; return digits; }\n        digits[i] = 0;\n    }\n    digits.insert(digits.begin(), 1);\n    return digits;\n}" },
      { language: 'java', code: "int[] plusOne(int[] digits) {\n    for (int i = digits.length - 1; i >= 0; i--) {\n        if (digits[i] < 9) { digits[i]++; return digits; }\n        digits[i] = 0;\n    }\n    int[] r = new int[digits.length + 1];\n    r[0] = 1;\n    return r;\n}" },
      { language: 'pseudocode', code: "function plusOne(digits):\n    for i from last to first:\n        if digits[i] < 9: digits[i] += 1; return digits\n        digits[i] = 0\n    return [1] followed by digits" },
    ],
  },
  {
    slug: 'search-insert-position',
    title: 'Search Insert Position',
    difficulty: 'easy',
    topic: 'Binary Search',
    prompt: 'Given a sorted array `nums` of distinct integers and a `target`, return the index if it is found. If not, return the index where it would be inserted to keep the array sorted.\n\nExample: ([1, 3, 5, 6], 5) → 2; ([1, 3, 5, 6], 2) → 1; ([1, 3, 5, 6], 7) → 4.',
    funcName: { python: 'search_insert', javascript: 'searchInsert' },
    starter: {
      python: 'def search_insert(nums, target):\n    # your code here\n    pass',
      javascript: 'function searchInsert(nums, target) {\n  // your code here\n}',
    },
    tests: [
      { args: [[1, 3, 5, 6], 5], expected: 2 },
      { args: [[1, 3, 5, 6], 2], expected: 1 },
      { args: [[1, 3, 5, 6], 7], expected: 4 },
      { args: [[1, 3, 5, 6], 0], expected: 0 },
    ],
    solutions: [
      { language: 'python', code: "def search_insert(nums, target):\n    lo, hi = 0, len(nums)\n    while lo < hi:\n        mid = (lo + hi) // 2\n        if nums[mid] < target:\n            lo = mid + 1\n        else:\n            hi = mid\n    return lo" },
      { language: 'javascript', code: "function searchInsert(nums, target) {\n  let lo = 0, hi = nums.length;\n  while (lo < hi) {\n    const mid = (lo + hi) >> 1;\n    if (nums[mid] < target) lo = mid + 1; else hi = mid;\n  }\n  return lo;\n}" },
      { language: 'cpp', code: "int searchInsert(vector<int>& nums, int target) {\n    int lo = 0, hi = nums.size();\n    while (lo < hi) {\n        int mid = (lo + hi) / 2;\n        if (nums[mid] < target) lo = mid + 1; else hi = mid;\n    }\n    return lo;\n}" },
      { language: 'java', code: "int searchInsert(int[] nums, int target) {\n    int lo = 0, hi = nums.length;\n    while (lo < hi) {\n        int mid = (lo + hi) / 2;\n        if (nums[mid] < target) lo = mid + 1; else hi = mid;\n    }\n    return lo;\n}" },
      { language: 'pseudocode', code: "function searchInsert(nums, target):\n    binary search for the leftmost index i with nums[i] >= target\n    return i" },
    ],
  },
  {
    slug: 'roman-to-integer',
    title: 'Roman to Integer',
    difficulty: 'easy',
    topic: 'Strings & Math',
    prompt: 'Convert a Roman numeral `s` to an integer. Values: I=1, V=5, X=10, L=50, C=100, D=500, M=1000. A smaller symbol before a larger one is subtracted.\n\nExample: "III" → 3; "LVIII" → 58; "MCMXCIV" → 1994.',
    funcName: { python: 'roman_to_int', javascript: 'romanToInt' },
    starter: {
      python: 'def roman_to_int(s):\n    # your code here\n    pass',
      javascript: 'function romanToInt(s) {\n  // your code here\n}',
    },
    tests: [
      { args: ['III'], expected: 3 },
      { args: ['LVIII'], expected: 58 },
      { args: ['MCMXCIV'], expected: 1994 },
      { args: ['IV'], expected: 4 },
    ],
    solutions: [
      { language: 'python', code: "def roman_to_int(s):\n    val = {'I': 1, 'V': 5, 'X': 10, 'L': 50, 'C': 100, 'D': 500, 'M': 1000}\n    total = 0\n    for i, c in enumerate(s):\n        if i + 1 < len(s) and val[c] < val[s[i + 1]]:\n            total -= val[c]\n        else:\n            total += val[c]\n    return total" },
      { language: 'javascript', code: "function romanToInt(s) {\n  const val = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };\n  let total = 0;\n  for (let i = 0; i < s.length; i++) {\n    if (i + 1 < s.length && val[s[i]] < val[s[i + 1]]) total -= val[s[i]];\n    else total += val[s[i]];\n  }\n  return total;\n}" },
      { language: 'cpp', code: "int romanToInt(string s) {\n    unordered_map<char,int> v = {{'I',1},{'V',5},{'X',10},{'L',50},{'C',100},{'D',500},{'M',1000}};\n    int total = 0;\n    for (int i = 0; i < s.size(); i++) {\n        if (i + 1 < s.size() && v[s[i]] < v[s[i + 1]]) total -= v[s[i]];\n        else total += v[s[i]];\n    }\n    return total;\n}" },
      { language: 'java', code: "int romanToInt(String s) {\n    Map<Character,Integer> v = Map.of('I',1,'V',5,'X',10,'L',50,'C',100,'D',500,'M',1000);\n    int total = 0;\n    for (int i = 0; i < s.length(); i++) {\n        char c = s.charAt(i);\n        if (i + 1 < s.length() && v.get(c) < v.get(s.charAt(i + 1))) total -= v.get(c);\n        else total += v.get(c);\n    }\n    return total;\n}" },
      { language: 'pseudocode', code: "function romanToInt(s):\n    map each symbol to its value\n    total = 0\n    for each symbol, if its value < the next symbol's value: subtract it; else add it\n    return total" },
    ],
  },
  {
    slug: 'fibonacci',
    title: 'Fibonacci Number',
    difficulty: 'easy',
    topic: 'Recursion & DP',
    prompt: 'Return the n-th Fibonacci number, where fib(0) = 0, fib(1) = 1, and fib(n) = fib(n-1) + fib(n-2).\n\nExample: fib(10) → 55.',
    funcName: { python: 'fib', javascript: 'fib' },
    starter: {
      python: 'def fib(n):\n    # your code here\n    pass',
      javascript: 'function fib(n) {\n  // your code here\n}',
    },
    tests: [
      { args: [0], expected: 0 },
      { args: [1], expected: 1 },
      { args: [10], expected: 55 },
      { args: [20], expected: 6765 },
    ],
    solutions: [
      { language: 'python', code: "def fib(n):\n    a, b = 0, 1\n    for _ in range(n):\n        a, b = b, a + b\n    return a" },
      { language: 'javascript', code: "function fib(n) {\n  let a = 0, b = 1;\n  for (let i = 0; i < n; i++) { const t = a + b; a = b; b = t; }\n  return a;\n}" },
      { language: 'cpp', code: "long long fib(int n) {\n    long long a = 0, b = 1;\n    for (int i = 0; i < n; i++) { long long t = a + b; a = b; b = t; }\n    return a;\n}" },
      { language: 'java', code: "long fib(int n) {\n    long a = 0, b = 1;\n    for (int i = 0; i < n; i++) { long t = a + b; a = b; b = t; }\n    return a;\n}" },
      { language: 'pseudocode', code: "function fib(n):\n    a = 0, b = 1\n    repeat n times: (a, b) = (b, a + b)\n    return a" },
    ],
  },
];

export const problemBySlug = (slug: string): Problem | undefined => PROBLEMS.find((p) => p.slug === slug);
