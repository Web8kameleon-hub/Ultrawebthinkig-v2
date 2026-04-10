module ulx3s_top (&#10;    input  wire clk_25mhz,&#10;    input  wire btn0,        // reset&#10;    output wire uart_tx&#10;);&#10;&#10;    wire clk = clk_25mhz;&#10;    wire resetn = ~btn0;      // active low&#10;&#10;    soc_top soc (&#10;        .clk(clk),&#10;        .resetn(resetn),&#10;        .uart_tx(uart_tx)&#10;    );&#10;&#10;endmodule
serv
