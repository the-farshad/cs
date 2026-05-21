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
];

export const problemBySlug = (slug: string): Problem | undefined => PROBLEMS.find((p) => p.slug === slug);
