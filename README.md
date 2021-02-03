# Translate Khmer

Try this online at [schreiberbrett.github.io/translate-khmer](https://schreiberbrett.github.io/translate-khmer). No installation required.

## Instructions
Paste a Khmer (Cambodian) sentence into the provided text box and click "Lookup". The computer will then list the words (and their English definitions) that form the given sentence. Written Khmer does not use spaces, so this project aims to help non-native speakers identify the words that make up a sentence.

## Technical Details
This project was created using [Svelte](https://svelte.dev/). It uses the following divide-and-conquer algorithm to split a sentence into its words, preferring larger matches over smaller ones:

```
Given the sentence: iameatingeggs

Trying 13.
[iameatingeggs]
No 13-letter word found.


[iameatingegg]s
i[ameatingeggs]

No 12-letter word found.


Tryng 11.

[iameatingeg]gs
i[ameatingegg]s
ia[meatingeggs]

No 11-letter word found.


Tryng length 10.

[iameatinge]ggs
i[ameatingeg]gs
ia[meatingegg]s
iam[eatingeggs]

No 10-letter word found.


Tryng length 9.

[iameating]eggs
i[ameatinge]ggs
ia[meatingeg]gs
iam[eatingegg]s
iame[atingeggs]

No 9-letter word found.


Tryng length 8.

[iameatin]geggs
i[ameating]eggs
ia[meatinge]ggs
iam[eatingeg]gs
iame[atingegg]s
iamea[tingeggs]

No 8-letter word found.


Tryng length 7.

[iameati]ngeggs
i[ameatin]geggs
ia[meating]eggs
iam[eatinge]ggs
iame[atingeg]gs
iamea[tingegg]s
iameat[ingeggs]

No 7-letter word found.


Tryng length 6.

[iameat]ingeggs
i[ameati]ngeggs
ia[meatin]geggs
iam[eating]eggs

Found the 6-letter word "eating".



Continue the algorithm recursively on either side.
Compute ("iam")   +  [eating] + Compute ("eggs")
           |            |                  |
         +-+---+        |                  |
         |     |        |                  |
         v     v        v                  v
Result  [i] + [am] + [eating]      +     [eggs]
```
