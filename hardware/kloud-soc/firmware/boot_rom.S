.section .text._start&#10;.global _start&#10;&#10;_start:&#10;    la sp, _stack_top&#10;    la t0, supervisor_main&#10;    jr t0
