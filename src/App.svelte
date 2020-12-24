<script lang="ts">
	let input: string = '';

	type Maybe<T> = {
		kind: 'Nothing',
	} | {
		kind: 'Just'
		value: T
	}

	type KhmerWord = {
		word: string,
		ipa: string,
		definitions: string[]
	}

	function range(start: number, stop: number): number[] {
		let result: number[] = []
		for (let i = 0; i < (stop - start); i++) {
			result[i] = start + i
		}

		return result
	}

	function parse(word: string, rawWikiHtml: string): Maybe<KhmerWord> {
		const dummy = document.createElement('div')
		dummy.innerHTML = rawWikiHtml
		
		const maybeIPA = find(
			Array.from(dummy.querySelectorAll('span[class="IPA"][lang="km"]')).map(x => x.textContent),
			x => x.startsWith('/') && x.endsWith('/')
		)

		if (maybeIPA.kind === 'Nothing') {
			return {kind: 'Nothing'}
		}

		return {
			kind: 'Just',
			value: {
				word,
				ipa: maybeIPA.value,
				definitions: Array.from(dummy.querySelectorAll('ol > li')).map(x => x.textContent)
			}
		}
	}

	function apiLink(page: string): string {
		let target = new URL('https://en.wiktionary.org/w/api.php')
		target.search = new URLSearchParams({
			action: 'parse',
			format: 'json',
			origin: '*',
			page: page
		}).toString()

		return target.toString()
	}

	let cache = new Map<String, Promise<Maybe<KhmerWord>>> ()

	function getKhmerWord(word: string): Promise<Maybe<KhmerWord>> {
		if (!cache.has(word)) {
			cache.set(word, fetch(apiLink(word))
				.then(x => x.json())
				.then(x => {
					if (!x.parse) return {kind: 'Nothing'}

					return parse(word, x.parse.text['*'])
				}))
		}

		return cache.get(word)
	}

	function head<T>(list: T[]): Maybe<T> {
		if (list.length === 0) {
			return {kind: 'Nothing'}
		}

		return {kind: 'Just', value: list[0]}
	}

	function justs<T>(list: Maybe<T>[]): T[] {
		let result: T[] = []

		for (let i = 0; i < list.length; i++) {
			const maybe = list[i]
			if (maybe.kind === 'Just') {
				result.push(maybe.value)
			}
		}

		return result
	}

	type Either<L, R> = {
		kind: 'Left'
		value: L
	} | {
		kind: 'Right',
		value: R
	}

	function left<L, R>(value: L): Either<L, R> {
		return {
			kind: 'Left',
			value
		}
	}

	function right<L, R>(value: R): Either<L, R> {
		return {
			kind: 'Right',
			value
		}
	}

	// Find the largest substrings of that produce a result B. Arrange in order with the substrings that return A
	function greedyChunking<A>(str: string, f: (a: string) => Promise<Maybe<A>>): Promise<Either<string, A>[]> {
		if (str.length === 0) {
			return Promise.resolve([])
		}

		return firstMatchingString(str, f).then(maybe => {
			if (maybe.kind === 'Nothing') {
				return [left(str)]
			}

			const [first, middle, last] = maybe.value

			return Promise.all([greedyChunking(first, f), greedyChunking(last, f)]).then(([newFirst, newLast]) => [...newFirst, right(middle), ...newLast])
		})
	}

	function firstMatchingString<A>(str: string, f: (a: string) => Promise<Maybe<A>>): Promise<Maybe<[string, A, string]>> {
		const highToLow = range(2, str.length + 1).reverse()

		const substrings = highToLow.flatMap(n => myLengthNSubstrings(str, n))

		const promises: Promise<Maybe<[string, A, string]>>[] = substrings.map(([first, middle, last]) => f(middle).then(maybe => {
			if (maybe.kind === 'Just') {
				return {kind: 'Just', value: [first, maybe.value, last]}
			} else {
				return {kind: 'Nothing'}
			}
		}))

		return maybeFirstJust(promises)
	}

	function maybeFirstJust<A>(array: Promise<Maybe<A>>[]): Promise<Maybe<A>> {
		return Promise.all(array).then(xs => head(justs(xs)))
	}

	function myLengthNSubstrings(str: string, n: number): [string, string, string][] {
		const numberOfSubstrings = (str.length - n) + 1;

		let result = new Array<[string, string, string]>(numberOfSubstrings)
		
		for (let i = 0; i < numberOfSubstrings; i++) {
			result[i] = [str.substring(0, i), str.substring(i, i + n), str.substring(i + n, str.length)]
		}

		return result
	}

	function findWords(khmerSentence: string): void {
		greedyChunking(khmerSentence, getKhmerWord).then(result => {
			state = {kind: 'Started', value: result}
		})
	}

	let state: {kind: 'Not Started'} | {kind: 'Started', value: Either<string, KhmerWord>[]} = {kind: 'Not Started'}

	function find<T>(list: T[], predicate: (t: T) => boolean): Maybe<T> {
		for (let x of list) {
			if (predicate(x)) {
				return {kind: 'Just', value: x}
			}
		}

		return {kind: 'Nothing'}
	}

	function breakdown(str: string): string {
		return range(0, str.length).map(i => str.charAt(i)).join(' + ')
	}

</script>

<div class="outer">
<div class="container">
	<textarea placeholder="Paste a Khmer sentence here" bind:value={input}></textarea>

	<button on:click={_ => findWords(input)} disabled={input.length === 0}>Lookup</button>

	{#if state.kind === 'Started'}
		<table>
			<tr>
				<th>IPA</th>
				<th>Word</th>
				<th>Breakdown</th>
				<th>Definition</th>
			</tr>
			{#each state.value as either}
			<tr>
				{#if either.kind === 'Left'}
					<td class="ipa"></td>
					<td class="word">{either.value}</td>
					<td class="breakdown">{breakdown(either.value)}</td>
					<td></td>
				{:else if either.kind === 'Right'}
					<td class="ipa">{either.value.ipa}</td>
					<td class="word"><a target="_blank" href="https://en.wiktionary.org/wiki/{either.value.word}">{either.value.word}</a></td>
					<td class="breakdown">{breakdown(either.value.word)}</td>
					<td>{either.value.definitions[0]}</td>
				{/if}
				</tr>
			{/each}
		</table>
	{/if}
</div>
</div>

<style>
	.ipa, .word, .breakdown {
		white-space: nowrap;
	}

	.outer {
		width: 100%;
	}

	.container {
		width: min(70vh, 100%);
		display: block;
		margin: 0 auto;
	}

	textarea, button {
		font-size: x-large;
		width: 100%;
	}

	textarea {
		resize: vertical;
	}

	table {
		border-spacing: 10px;
	}
</style>